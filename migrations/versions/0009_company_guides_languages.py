"""Language-aware knowledge and practical company/import guides."""

from datetime import UTC, datetime
from uuid import NAMESPACE_URL, uuid5

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None

ARTICLES = [
    (
        "ru",
        "Компании и задания: личный атлас подготовки",
        "Компании",
        """## Соберите контекст

Откройте «Компании». Компании из сохранённых вакансий уже находятся в каталоге. Заполните описание, сайт, локацию, стек и этапы отбора. Записи доступны только вашему аккаунту.

## Сохраните задания

Добавьте условие, критерии и ссылку на источник. Отметьте, является ли это заданием работодателя или вашим тренировочным упражнением. Сервис не утверждает, что компания использует задание, которое вы добавили самостоятельно.

## Используйте материалы

Из карточки можно добавить вакансию или начать интервью. Сохранённые стек, этапы и задания передаются как контекст тренировки. Архив скрывает компанию из активного списка, сохраняя данные.

## Импортируйте вакансию

В редакторе вакансии вставьте публичную ссылку и нажмите «Разобрать с ИИ». Проверьте черновик и перенесите его в форму. Если сайт требует входа или блокирует загрузку, вставьте текст. ИИ не придумывает отсутствующие сведения; заполните их вручную.""",
    ),
    (
        "en",
        "Start with a vacancy and build a factual resume",
        "Getting started",
        """## Choose a target

Open Vacancies and add the role, company and requirements. Import a public link with AI, review the preview, then apply it to the editable form. If the website blocks access, paste the text. Missing details remain blank. Saving requires your confirmation.

## Build from real experience

Complete your profile with experience, projects, education and skills. Create a resume from selected profile sections or upload a PDF, DOCX or TXT file up to 5 MB. Check extracted roles, dates and responsibilities. AI assistance requires a configured provider and must not invent qualifications.

## Keep and export versions

Edit the draft, save versions and export PDF or Word. Accepting an AI proposal saves the before and after versions together. Link the resume to a vacancy to reuse its context. Set an application stage, next action and contact date.""",
    ),
    (
        "en",
        "Research companies and save test assignments",
        "Companies",
        """## Your company atlas

Companies from your vacancies appear in Companies. Add their website, location, stack, hiring process and private notes. These records belong to your account.

## Keep the source

Add an assignment title, brief, criteria and source link. Mark it as an employer assignment or a practice exercise. Your own exercises are not evidence of a company's actual hiring process.

## Prepare in context

Start an interview from a company or add a vacancy. Saved technologies, hiring stages and assignments become interview context. Archive a company to hide it from the active list without losing your research.""",
    ),
    (
        "en",
        "Interview practice, learning and progress",
        "Preparation",
        """## Practice deliberately

Select a saved company and vacancy, choose skills, and enable theory, practice or both. Text interviews support optional browser dictation. Live voice conversations use OpenAI and require microphone permission. Review each answer in interview history; unfinished sessions can be continued.

## Turn feedback into practice

Create a learning plan with a target position, preferred stack and goal. A plan started from a vacancy can use its resume and latest completed interview. Complete exercises and record evidence. Repeatedly toggling completion does not earn extra experience.

## Read the dashboard honestly

Choose which dashboard widgets to show. Compare weekly activity, review missing skills and plan the next contact. Levels and practice scores reflect preparation, not the probability of receiving an offer. Existing content stays in the language in which it was written.""",
    ),
    (
        "en",
        "Account data and language settings",
        "Account",
        """## Choose a language

The interface supports Russian, English and Kazakh. Change it in the language menu or Settings. Your own notes, employer descriptions and existing AI responses are not automatically rewritten when you switch languages.

## Export or delete

Settings lets you download your account data as JSON. Changing a password ends old sessions on all devices. Password-account deletion requires the current password and account email. Download needed materials first. Shared skills and published articles remain. Google-account deletion requires the service operator.

## AI and privacy

AI actions send relevant materials to the configured provider. Voice mode stores transcripts and evaluations, not audio recordings. Provider retention and operator backups have separate rules. See Data and privacy for details.""",
    ),
    (
        "kk",
        "Бос орыннан бастап, нақты түйіндеме жасаңыз",
        "Алғашқы қадамдар",
        """## Мақсатты таңдаңыз

«Бос орындар» бөлімінде лауазымды, компанияны және талаптарды қосыңыз. Ашық сілтемені ЖИ арқылы талдап, нәтижені тексеріңіз де, өңделетін формаға көшіріңіз. Сайт қолжетімсіз болса, мәтінін қойыңыз. Жетіспейтін деректер бос қалады. Сақтауды өзіңіз растайсыз.

## Нақты тәжірибеден құрастырыңыз

Профильге тәжірибеңізді, жобаларды, білім мен дағдыларды енгізіңіз. Таңдалған бөлімдерден түйіндеме жасаңыз немесе 5 МБ-қа дейінгі PDF, DOCX не TXT жүктеңіз. Алынған лауазымдарды, күндерді және міндеттерді тексеріңіз. ЖИ үшін провайдер бапталуы керек; ол біліктілікті ойдан қоспауы тиіс.

## Нұсқаларды сақтаңыз

Жобаны өңдеп, нұсқаларын сақтаңыз және PDF не Word экспорттаңыз. ЖИ ұсынысын қабылдау бастапқы және кейінгі нұсқаларды бірге сақтайды. Контексті қайта қолдану үшін түйіндемені бос орынға тіркеңіз. Өтінім кезеңін, келесі әрекетті және байланыс күнін белгілеңіз.""",
    ),
    (
        "kk",
        "Компанияларды зерттеп, сынақ тапсырмаларын сақтаңыз",
        "Компаниялар",
        """## Компаниялар атласы

Бос орындарыңыздағы компаниялар «Компаниялар» бөлімінде көрінеді. Сайт, орналасқан жері, стек, іріктеу кезеңдері және жеке жазбалар қосыңыз. Бұл жазбалар тек аккаунтыңызға тиесілі.

## Дереккөзді сақтаңыз

Тапсырма атауын, шартын, критерийлерін және дереккөз сілтемесін қосыңыз. Жұмыс берушінің тапсырмасы ма, әлде жаттығу ма — белгілеңіз. Өз жаттығуларыңыз компанияның нақты іріктеу тәртібін дәлелдемейді.

## Контекстпен дайындалыңыз

Компаниядан сұхбат бастаңыз немесе бос орын қосыңыз. Сақталған технологиялар, кезеңдер мен тапсырмалар сұхбат контекстіне қосылады. Зерттеуді жоғалтпай белсенді тізімнен жасыру үшін компанияны мұрағаттаңыз.""",
    ),
    (
        "kk",
        "Сұхбатқа дайындық, оқу және ілгерілеу",
        "Дайындық",
        """## Мақсатты жаттығыңыз

Сақталған компания мен бос орынды, дағдыларды таңдаңыз. Теорияны, практиканы немесе екеуін қосыңыз. Мәтіндік сұхбатта браузер диктовкасы бар. Тікелей дауыстық сұхбат OpenAI мен микрофон рұқсатын қажет етеді. Тарихтан әр жауапты қараңыз; аяқталмаған сұхбатты жалғастыруға болады.

## Кері байланысты жаттығуға айналдырыңыз

Мақсатты лауазым, қалаған стек және мақсат бойынша оқу жоспарын жасаңыз. Бос орыннан басталған жоспар оның түйіндемесі мен соңғы аяқталған сұхбатын ескере алады. Тапсырмаларды орындап, нәтижелерін сақтаңыз. Орындалу белгісін қайта ауыстыру қосымша тәжірибе бермейді.

## Шолуды дұрыс түсініңіз

Көрсетілетін виджеттерді таңдаңыз. Апталық белсенділікті салыстырып, жетіспейтін дағдыларды қарап, келесі байланысты жоспарлаңыз. Деңгейлер мен ұпайлар ұсыныс алу ықтималдығын емес, дайындықты көрсетеді. Бұрынғы материалдар жазылған тілінде қалады.""",
    ),
    (
        "kk",
        "Аккаунт деректері және тіл баптаулары",
        "Аккаунт",
        """## Тілді таңдаңыз

Интерфейс орыс, ағылшын және қазақ тілдерін қолдайды. Тілді мәзірден немесе баптаулардан өзгертіңіз. Жеке жазбалар, жұмыс беруші сипаттамалары және бұрынғы ЖИ жауаптары тіл ауысқанда автоматты қайта жазылмайды.

## Экспорт және жою

Баптаулардан аккаунт деректерін JSON түрінде жүктеуге болады. Құпиясөзді өзгерту барлық құрылғыдағы ескі сеанстарды аяқтайды. Құпиясөзді аккаунтты жою үшін ағымдағы құпиясөз бен email қажет. Қажетті материалдарды алдымен жүктеңіз. Ортақ дағдылар мен жарияланған мақалалар қалады. Google аккаунтын оператор жояды.

## ЖИ және құпиялылық

ЖИ әрекеттері тиісті материалдарды бапталған провайдерге жібереді. Дауыстық режим аудионы емес, мәтін мен бағалауды сақтайды. Провайдер мен резервтік көшірмелердің бөлек сақтау ережелері бар. Толығырақ «Деректер мен құпиялылық» бөлімінде.""",
    ),
]


def upgrade():
    op.add_column(
        "knowledge_articles",
        sa.Column("language", sa.String(2), nullable=False, server_default="ru"),
    )
    table = sa.table(
        "knowledge_articles",
        *[
            sa.column(k)
            for k in [
                "id",
                "language",
                "title",
                "category",
                "body",
                "published",
                "revision",
                "updated_at",
            ]
        ],
    )
    op.bulk_insert(
        table,
        [
            dict(
                id=str(uuid5(NAMESPACE_URL, "career-studio/guide/" + language + "/" + title)),
                language=language,
                title=title,
                category=category,
                body=body,
                published=True,
                revision=1,
                updated_at=datetime.now(UTC),
            )
            for language, title, category, body in ARTICLES
        ],
    )


def downgrade():
    ids = [
        str(uuid5(NAMESPACE_URL, "career-studio/guide/" + language + "/" + title))
        for language, title, _, _ in ARTICLES
    ]
    table = sa.table("knowledge_articles", sa.column("id"))
    op.execute(table.delete().where(table.c.id.in_(ids)))
    op.drop_column("knowledge_articles", "language")
