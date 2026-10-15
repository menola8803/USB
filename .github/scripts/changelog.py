#!/usr/bin/env python3
"""Versionsnoteringar för USB.

  changelog.py prepare <version> <datum>
      Ser till att CHANGELOG.md har ett avsnitt för versionen:
      - finns "## Kommande version" döps det om till versionen,
      - annars skapas avsnittet från commit-meddelanden sedan förra versionen.
      Skriver versionens noteringar till release-notes.md.

  changelog.py sync
      Skriver noteringarna från CHANGELOG.md till varje befintlig release på GitHub.
"""
import re
import subprocess
import sys

PATH = 'CHANGELOG.md'
HEADER = '# Ändringar\n\nVarje version beskrivs här och under **Releases** på GitHub. Nya versioner läggs till automatiskt när de byggs.\n'
FOOTER = '\n\n---\nLadda ner APK-filen nedan (usb-versionsnummer.apk) och öppna filen på din Android-telefon för att installera.\n'


def read():
    try:
        return open(PATH, encoding='utf-8').read()
    except FileNotFoundError:
        return HEADER


def sections(text):
    """Returnerar [(rubrik, innehåll)] för varje '## '-avsnitt."""
    parts = re.split(r'^## ', text, flags=re.M)
    return [(p.split('\n', 1)[0].strip(), p.split('\n', 1)[1].strip() if '\n' in p else '') for p in parts[1:]]


def sh(*args):
    return subprocess.run(args, capture_output=True, text=True).stdout.strip()


def notes_from_commits():
    last = sh('git', 'describe', '--tags', '--abbrev=0')
    rng = f'{last}..HEAD' if last else 'HEAD'
    log = sh('git', 'log', '--no-merges', '--format=%B%x00', rng)
    bullets = []
    for msg in log.split('\x00'):
        lines = [l.rstrip() for l in msg.strip().splitlines()]
        if not lines or '[skip ci]' in lines[0]:
            continue
        bullets.append(f'- {lines[0]}')
        for l in lines[1:]:
            if l.startswith(('Co-Authored-By:', 'Claude-Session:')) or not l.strip():
                continue
            if l.startswith('- '):
                bullets.append(f'  {l}')
    return '\n'.join(bullets) or '- Mindre förbättringar.'


def prepare(version, date):
    text = read()
    title = f'Version {version} – {date}'
    if re.search(rf'^## Version {re.escape(version)}\b', text, flags=re.M):
        pass
    elif re.search(r'^## Kommande version[ \t]*$', text, flags=re.M):
        text = re.sub(r'^## Kommande version[ \t]*$', f'## {title}', text, count=1, flags=re.M)
    else:
        body = notes_from_commits()
        m = re.search(r'^## ', text, flags=re.M)
        block = f'## {title}\n\n{body}\n\n'
        text = text[:m.start()] + block + text[m.start():] if m else text.rstrip() + '\n\n' + block
    open(PATH, 'w', encoding='utf-8').write(text)
    for head, body in sections(text):
        if head.startswith(f'Version {version} '):
            open('release-notes.md', 'w', encoding='utf-8').write(body + FOOTER)
            return
    open('release-notes.md', 'w', encoding='utf-8').write(FOOTER)


def sync():
    tags = set(sh('git', 'tag').split())
    for head, body in sections(read()):
        m = re.match(r'Version (\d+\.\d+\.\d+)', head)
        if not m or f'v{m.group(1)}' not in tags:
            continue
        open('notes.tmp', 'w', encoding='utf-8').write(body + FOOTER)
        r = subprocess.run(['gh', 'release', 'edit', f'v{m.group(1)}', '--notes-file', 'notes.tmp'], capture_output=True, text=True)
        print(f'v{m.group(1)}:', 'ok' if r.returncode == 0 else r.stderr.strip())


if __name__ == '__main__':
    if sys.argv[1] == 'prepare':
        prepare(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == 'sync':
        sync()
