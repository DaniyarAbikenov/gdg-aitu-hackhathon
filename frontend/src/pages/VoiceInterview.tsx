import { tr, useLocale } from "@/i18n/copy";
import type { VoiceEvent } from "@/types/product";
import type { InterviewRecord } from "@/api/interview";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import client from "@/api/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
type Turn = { id: string; role: "user" | "assistant"; text: string };
export default function VoiceInterview() {
  useLocale();
  const [params] = useSearchParams();
  const id = params.get("id");
  const navigate = useNavigate();
  const [record, setRecord] = useState<InterviewRecord | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(tr("copy.c497"));
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [pendingInput, setPendingInput] = useState(false);
  const [responding, setResponding] = useState(false);
  const peer = useRef<RTCPeerConnection | null>(null);
  const media = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const revision = useRef(0);
  const log = useRef<Turn[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(true);
  const cleanup = () => {
    media.current?.getTracks().forEach((t) => t.stop());
    peer.current?.close();
    peer.current = null;
    if (audio.current) audio.current.srcObject = null;
  };
  const stopServer = () =>
    fetch(`/api/interview/${id}/voice/stop`, {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => {});
  useEffect(() => {
    mounted.current = true;
    if (id)
      client
        .get(`/interview/${id}`)
        .then((r) => {
          if (!mounted.current) return;
          setRecord(r.data);
          revision.current = r.data.revision;
          log.current = r.data.transcript || [];
          setTurns([...log.current]);
        })
        .catch((e) => setError(e.message));
    return () => {
      mounted.current = false;
      cleanup();
      if (id) void stopServer();
    };
  }, [id]);
  const persist = (finish = false) => {
    const action = queue.current
      .catch(() => {})
      .then(async () => {
        const r = await client.post(`/interview/${id}/voice/transcript`, {
          revision: revision.current,
          turns: [...log.current],
          finish,
        });
        revision.current = r.data.revision;
        if (mounted.current) setRecord(r.data);
        return r;
      });
    queue.current = action;
    return action;
  };
  const capture = (event: VoiceEvent) => {
    const role =
      event.type === "conversation.item.input_audio_transcription.completed"
        ? "user"
        : event.type === "response.output_audio_transcript.done"
          ? "assistant"
          : null;
    if (!role || !event.transcript?.trim()) return;
    const key = `${role}:${event.item_id || event.response_id || event.event_id}`;
    if (log.current.some((t) => t.id === key)) return;
    if (role === "user") setPendingInput(false);
    log.current.push({ id: key, role, text: event.transcript });
    setTurns([...log.current]);
    void persist().catch(() => setError(tr("copy.c498")));
  };
  const start = async () => {
    setBusy(true);
    setError("");
    setStatus(tr("copy.c499"));
    setPendingInput(false);
    setResponding(false);
    setMuted(false);
    try {
      const caps = await client.get("/capabilities");
      if (!caps.data.voice) throw new Error(tr("copy.c500"));
      media.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (!mounted.current) {
        cleanup();
        return;
      }
      const pc = new RTCPeerConnection();
      peer.current = pc;
      pc.ontrack = (e) => {
        if (audio.current) {
          audio.current.srcObject = e.streams[0];
          void audio.current.play().catch(() => setStatus(tr("copy.c501")));
        }
      };
      pc.onconnectionstatechange = () => {
        if (["failed", "disconnected"].includes(pc.connectionState)) {
          cleanup();
          setConnected(false);
          setStatus(tr("copy.c502"));
          void stopServer();
        }
      };
      media.current.getTracks().forEach((t) => pc.addTrack(t, media.current!));
      const channel = pc.createDataChannel("oai-events");
      channel.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === "input_audio_buffer.speech_started")
            setPendingInput(true);
          if (event.type === "response.created") setResponding(true);
          if (event.type === "response.done") setResponding(false);
          if (event.type === "error") setError(tr("copy.c503"));
          else capture(event);
        } catch {
          setError(tr("copy.c504"));
        }
      };
      channel.onopen = () => {
        setConnected(true);
        setStatus(tr("copy.c505"));
        channel.send(
          JSON.stringify({
            type: "response.create",
            response: {
              instructions:
                "Greet the candidate briefly and ask the next interview question, in the configured language.",
            },
          }),
        );
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const r = await client.post(`/interview/${id}/voice/connect`, {
        sdp: offer.sdp,
        revision: revision.current,
      });
      revision.current = r.data.revision;
      if (!mounted.current) {
        cleanup();
        void stopServer();
        return;
      }
      await pc.setRemoteDescription({ type: "answer", sdp: r.data.sdp });
    } catch (e) {
      cleanup();
      void stopServer();
      setConnected(false);
      setError(e.message || tr("copy.c506"));
      setStatus(tr("copy.c507"));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const finish = async () => {
    setBusy(true);
    setError("");
    cleanup();
    setConnected(false);
    try {
      await persist(true);
      navigate(`/interview/summary?id=${id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const pause = async () => {
    cleanup();
    setConnected(false);
    setStatus(tr("copy.c508"));
    setPendingInput(false);
    setResponding(false);
    try {
      await stopServer();
      await persist();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-5">
        <h1 className="text-3xl font-bold">{tr("copy.c509")}</h1>
        <p className="text-muted-foreground">{tr("copy.c510")}</p>
        {record && (
          <p>
            {record.context.company_name} · {record.context.vacancy_title}
          </p>
        )}
        <p role="status">{status}</p>
        {error && (
          <div role="alert" className="text-destructive">
            {error}
            <Button
              variant="link"
              onClick={() =>
                persist()
                  .then(() => setError(""))
                  .catch((e) => setError(e.message))
              }
            >
              {tr("copy.c511")}
            </Button>
          </div>
        )}
        <audio ref={audio} autoPlay controls className="w-full" />
        <div className="flex flex-wrap gap-3">
          {!connected && !record?.finished && (
            <Button disabled={busy || !record} onClick={start}>
              {tr("copy.c512")}
            </Button>
          )}
          {connected && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  media.current?.getAudioTracks().forEach((t) => {
                    t.enabled = muted;
                  });
                  setMuted(!muted);
                }}
              >
                {muted ? tr("copy.c513") : tr("copy.c514")}
              </Button>
              <Button variant="outline" onClick={pause}>
                {tr("copy.c515")}
              </Button>
            </>
          )}
          {!record?.finished && (
            <Button
              disabled={
                busy ||
                pendingInput ||
                responding ||
                !turns.some((t) => t.role === "user")
              }
              onClick={finish}
            >
              {tr("copy.c516")}
            </Button>
          )}
          <Link to="/interview">{tr("copy.c517")}</Link>
        </div>
        <section
          aria-label={tr("copy.c518")}
          className="border rounded-xl p-4 space-y-4 min-h-64"
        >
          {!turns.length && (
            <p className="text-muted-foreground">{tr("copy.c519")}</p>
          )}
          {turns.map((t) => (
            <div
              key={t.id}
              className={`rounded-lg p-3 ${t.role === "user" ? "bg-primary/10 ml-6" : "bg-muted mr-6"}`}
            >
              <p className="font-medium text-sm mb-1">
                {t.role === "user" ? tr("copy.c033") : tr("copy.c520")}
              </p>
              <p className="whitespace-pre-wrap break-words">{t.text}</p>
            </div>
          ))}
        </section>
      </div>
    </MainLayout>
  );
}
