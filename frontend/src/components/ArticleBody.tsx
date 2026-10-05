export function ArticleBody({ body }: { body: string }) {
  return (
    <div className="space-y-4 leading-relaxed break-words">
      {body
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((block, i) =>
          block.startsWith("## ") ? (
            <h2 className="text-xl font-semibold pt-3" key={i}>
              {block.slice(3)}
            </h2>
          ) : (
            <p className="whitespace-pre-wrap" key={i}>
              {block}
            </p>
          ),
        )}
    </div>
  );
}
