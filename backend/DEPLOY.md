# 🚀 Law+ — Пускане на живо (Deploy)

Всичко е подготвено — сървърът се вдига с **2 скрипта**. Това ръководство е
целият път от нула до работещ сайт с HTTPS и плащания.

## Какво трябва да купиш (еднократно, ~30 мин)

1. **VPS сървър** — Hetzner (CX22, ~5 €/мес) или DigitalOcean (~6 $/мес).
   Избери Ubuntu 24.04. 2 GB RAM са предостатъчни.
2. **Домейн** — от Superhosting/Jump.bg/Namecheap (~15-25 лв/год за .bg или ~12 $/год за .com).
3. **Stripe акаунт** — stripe.com (безплатен; взимат % от всяка продажба).

## Стъпка 1: Качи пакета на сървъра (5 мин)

```bash
# От твоя компютър (папката pravo-academy съдържа backend/ и site/):
scp -r pravo-academy root@IP-НА-СЪРВЪРА:/opt/
ssh root@IP-НА-СЪРВЪРА
cd /opt/pravo-academy/backend
```

## Стъпка 2: Пусни setup скрипта (10 мин)

```bash
bash scripts/server-setup.sh
```

Скриптът сам: инсталира Docker, настройва firewall (само 22/80/443),
генерира силни пароли (JWT, база), пита те за домейн + Stripe ключове
(може и по-късно), стартира целия stack (база + API + сайт + Redis),
и настройва нощни бекъпи в 3:00.

След него сайтът вече работи на `http://IP-НА-СЪРВЪРА`.

## Стъпка 3: Домейн + HTTPS (10 мин)

1. В панела на домейна: **A запис** → IP-то на сървъра (`@` и `www` ако искаш)
2. Изчакай DNS-а (5-30 мин), после на сървъра:

```bash
bash scripts/init-letsencrypt.sh pravo-academy.bg твоя@имейл.bg
```

Готово — `https://pravo-academy.bg` със сертификат, който се подновява сам.

## Стъпка 4: Stripe на живо (10 мин)

1. [dashboard.stripe.com](https://dashboard.stripe.com) → активирай акаунта (лични данни, банкова сметка за изплащания)
2. **API keys** → копирай Live secret key → в `.env` на сървъра (`nano .env` → `STRIPE_SECRET_KEY=sk_live_...`)
3. **Webhooks → Add endpoint**: `https://pravo-academy.bg/webhooks/stripe`
   - Събития: `checkout.session.completed`, `charge.refunded`
   - Копирай Signing secret → `.env` → `STRIPE_WEBHOOK_SECRET=whsec_...`
4. Рестарт: `docker compose -f docker-compose.prod.yml up -d api`
5. **Тест**: купи пакет с тестова карта `4242 4242 4242 4242` (в test mode)
   или направи истинска покупка за 35 € и си я refund-ни от админ панела.

## Стъпка 5: Останалите ключове (по избор, по всяко време)

В `.env` на сървъра (`nano .env`, после `docker compose -f docker-compose.prod.yml up -d api`):

| Ключ | За какво | Откъде |
|---|---|---|
| `ANTHROPIC_API_KEY` | Истински AI отговори | console.anthropic.com (иначе AI_STUB=1 = демо) |
| `SMTP_USER/SMTP_PASSWORD` | Имейли (потвърждения, напомняния) | Gmail App Password или Mailgun/Brevo |
| `EMAIL_FROM` | Подателят на имейлите | noreply@pravo-academy.bg |

## Ежедневието след пускането

**Обновяване на сайта** (нова версия на pravoacademy.html):
```bash
scp site/index.html root@IP:/opt/pravo-academy/site/index.html
# нищо друго — nginx го сервира веднага
```

**Обновяване на учебното съдържание**: админ панелът в сайта →
Export → `PUT /api/admin/content` (или просто нов HTML файл с вградени данни).

**Обновяване на backend-а**:
```bash
cd /opt/pravo-academy/backend
docker compose -f docker-compose.prod.yml up -d --build api
```

**Бекъпи**: автоматични всяка нощ (пазят се 14). Ръчно: `bash scripts/backup-db.sh`.
Възстановяване: `bash scripts/restore-db.sh backups/файл.sql.gz`.
⚠ Веднъж седмично сваляй бекъп и ИЗВЪН сървъра (scp на твоя компютър).

**Логове при проблем**:
```bash
docker compose -f docker-compose.prod.yml logs -f api    # backend
docker compose -f docker-compose.prod.yml logs -f web    # nginx
docker compose -f docker-compose.prod.yml ps             # статус на всичко
```

**Мониторинг** (безплатно): uptimerobot.com → следи `https://домейн/health`
и ти праща имейл ако сайтът падне.

## Чеклист преди първите реални клиенти

- [ ] HTTPS работи (катинарчето в браузъра)
- [ ] Тестова покупка мина и пакетът се отключи
- [ ] Refund от админ панела работи
- [ ] Имейлът за покупка пристига (провери и спам папката)
- [ ] Регистрация + вход от телефон работи
- [ ] Прогресът се синхронизира (учи на лаптоп, отвори от телефон)
- [ ] `UPDATE users SET role='admin' WHERE email='твоя@имейл';` — за да си админ
- [ ] Смени демо акаунтите или ги изтрий (`UPDATE users SET is_active=false WHERE email LIKE '%@pravo-academy.bg';`)
- [ ] Общи условия и Privacy Policy прегледани от юрист (ти си юрист — лесно 😄)

## Колко струва месечно

| Разход | Цена |
|---|---|
| VPS (Hetzner CX22) | ~5 €/мес |
| Домейн | ~2 лв/мес |
| Stripe | 1.5% + 0.25 € на европейска карта (само при продажба) |
| AI (Claude Haiku) | ~0.01-0.03 лв на въпрос (при 30/ден лимит — няколко лева/мес) |
| SMTP (Brevo free tier) | 0 лв до 300 имейла/ден |
| **Общо фиксирани** | **~12-15 лв/мес** |
