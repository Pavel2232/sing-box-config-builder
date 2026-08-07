# Security Policy

## Supported versions

Security fixes are applied to the current `main` branch and the latest public
release. Older snapshots and forks are not maintained by this project.

## Reporting a vulnerability

Do not open a public issue for a vulnerability that could expose subscription
credentials, bypass URL validation, reach local network services, leak a Happ
HWID, or execute untrusted content.

Use GitHub's private vulnerability reporting page:

<https://github.com/Pavel2232/sing-box-config-builder/security/advisories/new>

If the private form is unavailable, contact
[@Pavel2232](https://github.com/Pavel2232) through a private contact method
listed on the profile. Do not include working secrets in the first message.

Please provide:

- the affected commit or version;
- impact and attack scenario;
- minimal reproduction steps using fictional credentials;
- suggested mitigation, if known.

You should receive an acknowledgement within 7 days. A fix and disclosure
timeline will be coordinated according to severity. Please allow time for a
patch before publishing technical details.

## Not a security vulnerability

Provider outages, blocked VPN endpoints, unsupported XHTTP nodes, routing list
requests, and OpenWrt installation questions belong in regular issues. See
[SUPPORT.md](SUPPORT.md).

## По-русски

Уязвимости не публикуйте в обычных issues. Используйте приватный Security
Advisory по ссылке выше и не отправляйте реальные ключи подписки или HWID.
Проблемы конкретного VPN-провайдера и вопросы настройки относятся к поддержке,
а не к security report.
