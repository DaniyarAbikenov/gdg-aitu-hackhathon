import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {useToast} from "@/hooks/use-toast";
import {MultiSelect} from "@/components/MultiSelect";
import {LanguageSwitcher} from "@/components/LanguageSwitcher";
import {LANGUAGES} from "@/data/languages";
import {getAllRoles} from "@/data/roles";
import {updateUserProfile, getUserProfile} from "@/api/user";
import {getErrorMessage} from "@/lib/errors";
import {auth} from "@/lib/firebase";
import {MainLayout} from "@/components/layout/MainLayout.tsx";

export default function Onboarding() {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const {toast} = useToast();

    const [loading, setLoading] = useState(true);

    // ---- form fields ----
    const [name, setName] = useState("");
    const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [skillInput, setSkillInput] = useState("");
    const [skills, setSkills] = useState<string[]>([]);
    const [normalizedSkills, setNormalizedSkills] = useState<string[]>([]);

    // ---- load data from backend ----
    useEffect(() => {
        (async () => {
            try {
                const user = auth.currentUser;
                if (!user) {
                    toast({ title: t("common.error"), description: "Вы не авторизованы", variant: "destructive" });
                    navigate("/login");
                    return;
                }

                const profile = await getUserProfile(); // GET /user/profile
                if (profile) {
                    setName(profile.full_name || "");

                    setSelectedLanguages(
                        profile.extra?.languages || []
                    );

                    // desired_position: string
                    // career_goal: "Role1, Role2"
                    const rolesParsed = [];
                    if (profile.desired_position) rolesParsed.push(profile.desired_position);
                    if (profile.career_goal) {
                        rolesParsed.push(...profile.career_goal.split(",").map(r => r.trim()));
                    }
                    setSelectedRoles([...new Set(rolesParsed)]);

                    setSkills(profile.skills || []);
                    setNormalizedSkills(profile.extra?.normalized_skills || []);
                }
            } catch (err) {
                toast({ title: t("common.error"), description: getErrorMessage(err), variant: "destructive" });
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const addSkill = () => {
        if (skillInput && !skills.includes(skillInput)) {
            setSkills([...skills, skillInput]);
            setSkillInput("");
        }
    };

    const removeSkill = (skill: string) => {
        setSkills(skills.filter(s => s !== skill));
    };

    const handleNormalize = () => {
        const normalized = skills.map(s => s.toLowerCase().trim());
        setNormalizedSkills([...new Set(normalized)]);
        toast({
            title: t("onboarding.normalizedSkills"),
            description: `Обработано ${normalized.length} навыков`,
        });
    };

    const handleSave = async () => {
        if (!name || selectedRoles.length === 0 || skills.length === 0) {
            toast({
                title: t("common.error"),
                description: "Заполните все обязательные поля",
                variant: "destructive",
            });
            return;
        }

        try {
            const user = auth.currentUser;
            if (!user) {
                toast({
                    title: t("common.error"),
                    description: "Вы не авторизованы",
                    variant: "destructive",
                });
                return;
            }

            const payload = {
                full_name: name,
                email: user.email,
                desired_position: selectedRoles[0],
                career_goal: selectedRoles.join(", "),
                skills: skills,
                extra: {
                    languages: selectedLanguages,
                    normalized_skills: normalizedSkills,
                }
            };

            await updateUserProfile(payload);

            toast({
                title: t("common.success"),
                description: "Анкета сохранена",
            });

            navigate("/dashboard");

        } catch (err) {
            toast({
                title: t("common.error"),
                description: getErrorMessage(err),
                variant: "destructive",
            });
        }
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="p-8">Загрузка…</div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="min-h-screen bg-muted/30 p-6">
                <div className="max-w-3xl mx-auto space-y-6">
                    <Card className="relative">
                        <div className="absolute top-4 right-4 z-10">
                            <LanguageSwitcher/>
                        </div>

                        <CardHeader>
                            <CardTitle className="text-2xl">{t("onboarding.title")}</CardTitle>
                            <p className="text-sm text-muted-foreground">{t("onboarding.subtitle")}</p>
                        </CardHeader>

                        <CardContent className="space-y-6">

                            {/* NAME */}
                            <div className="space-y-2">
                                <Label htmlFor="name">{t("onboarding.name")}</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={t("onboarding.name")}
                                />
                            </div>

                            {/* LANGUAGES */}
                            <div className="space-y-2">
                                <Label>{t("onboarding.languages")}</Label>
                                <MultiSelect
                                    options={LANGUAGES}
                                    selected={selectedLanguages}
                                    onChange={setSelectedLanguages}
                                    placeholder={t("onboarding.languagesPlaceholder")}
                                    allowCustom={false}
                                />
                            </div>

                            {/* ROLES */}
                            <div className="space-y-2">
                                <Label>{t("onboarding.targetRoles")}</Label>
                                <MultiSelect
                                    options={getAllRoles()}
                                    selected={selectedRoles}
                                    onChange={setSelectedRoles}
                                    placeholder={t("onboarding.targetRolesPlaceholder")}
                                    allowCustom={true}
                                />
                            </div>

                            {/* SKILLS */}
                            <div className="space-y-2">
                                <Label>{t("onboarding.currentSkills")}</Label>

                                <div className="flex gap-2">
                                    <Input
                                        value={skillInput}
                                        onChange={(e) => setSkillInput(e.target.value)}
                                        placeholder={t("onboarding.currentSkillsPlaceholder")}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                                    />
                                    <Button type="button" onClick={addSkill}>+</Button>
                                </div>

                                <div className="flex flex-wrap gap-2 mt-2">
                                    {skills.map(skill => (
                                        <Badge key={skill} variant="secondary" className="gap-1">
                                            {skill}
                                            <button onClick={() => removeSkill(skill)}>×</button>
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button onClick={handleSave}>{t("onboarding.save")}</Button>
                                <Button variant="outline" onClick={handleNormalize}>
                                    {t("onboarding.evaluateSkills")}
                                </Button>
                            </div>

                            {normalizedSkills.length > 0 && (
                                <div className="space-y-2 pt-4 border-t">
                                    <Label>{t("onboarding.normalizedSkills")}</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {normalizedSkills.map(skill => (
                                            <Badge key={skill} variant="default">{skill}</Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </CardContent>
                    </Card>
                </div>
            </div>
        </MainLayout>
    );
}
