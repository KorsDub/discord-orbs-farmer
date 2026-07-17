#!/usr/bin/env python3
"""
KDStudio Discord Orbs Farmer
© KDStudio 2026

Только в образовательных целях.
Этот инструмент создаёт фейковые процессы игр, чтобы Discord мог их обнаружить по имени процесса.
Используйте на свой страх и риск. Авторы не несут ответственности за любые действия в отношении аккаунта.
"""

import os
import sys
import time
import shutil
import subprocess
from pathlib import Path

try:
    import requests
except ImportError:
    print("Не установлена зависимость: requests")
    print("Установите командой:  pip install requests")
    input("Нажмите Enter для выхода...")
    sys.exit(1)

# ====================== НАСТРОЙКИ ======================
VERSION   = "1.0.0"
DEVELOPER = "KDStudio"
FAKE_EXE_DIR = "Win64"

DISCORD_API   = "https://discord.com/api/v9/applications/detectable"
GITHUB_BACKUP = "https://gist.githubusercontent.com/Cynosphere/c1e77f77f0e565ddaac2822977961e76/raw/gameslist.json"

# ====================== ЦВЕТА ======================
class C:
    RESET   = "\033[0m"
    BOLD    = "\033[1m"
    RED     = "\033[91m"
    GREEN   = "\033[92m"
    YELLOW  = "\033[93m"
    CYAN    = "\033[96m"
    MAGENTA = "\033[95m"
    GRAY    = "\033[90m"
    WHITE   = "\033[97m"

def p(text, color=C.WHITE, bold=False):
    style = C.BOLD if bold else ""
    print(f"{style}{color}{text}{C.RESET}")

def banner():
    os.system("cls" if os.name == "nt" else "clear")
    print(f"""
{C.CYAN}{C.BOLD}
 ██╗  ██╗██████╗ ███████╗████████╗██╗   ██╗██████╗ ██╗ ██████╗ 
 ██║ ██╔╝██╔══██╗██╔════╝╚══██╔══╝██║   ██║██╔══██╗██║██╔═══██╗
 █████╔╝ ██║  ██║███████╗   ██║   ██║   ██║██║  ██║██║██║   ██║
 ██╔═██╗ ██║  ██║╚════██║   ██║   ██║   ██║██║  ██║██║██║   ██║
 ██║  ██╗██████╔╝███████║   ██║   ╚██████╔╝██████╔╝██║╚██████╔╝
 ╚═╝  ╚═╝╚═════╝ ╚══════╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝ ╚═════╝ 
{C.RESET}
    {C.MAGENTA}Discord Orbs Farmer{C.RESET}  ·  v{VERSION}  ·  © {DEVELOPER}
    {C.GRAY}Только в образовательных целях • Используйте на свой страх и риск{C.RESET}
""")

# ====================== БАЗА ИГР ======================
def load_games():
    p("\n[*] Загружаю базу определяемых игр Discord...", C.YELLOW)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Referer": "https://discord.com/",
        "Origin": "https://discord.com"
    }
    try:
        r = requests.get(DISCORD_API, headers=headers, timeout=12)
        r.raise_for_status()
        games = r.json()
        p(f"[OK] Загружено {len(games)} игр из официального API Discord", C.GREEN, True)
        return games
    except Exception as e:
        p(f"[!] API Discord недоступен: {e}", C.YELLOW)
        p("[*] Пробую резервный источник (GitHub)...", C.CYAN)
        try:
            r = requests.get(GITHUB_BACKUP, timeout=15)
            r.raise_for_status()
            games = r.json()
            p(f"[OK] Загружено {len(games)} игр из резерва", C.GREEN, True)
            return games
        except Exception as e2:
            p(f"[ERROR] Не удалось загрузить базу: {e2}", C.RED, True)
            return []

def search_games(games, query):
    q = query.lower()
    exact, partial = {}, {}
    for g in games:
        name = g.get("name", "").lower()
        aliases = [a.lower() for a in g.get("aliases", [])]
        gid = g.get("id")
        if q == name or q in aliases:
            exact[gid] = g
        elif q in name or any(q in a for a in aliases):
            partial[gid] = g
    return list(exact.values()) + [g for g in partial.values() if g.get("id") not in exact]

def get_exe(game):
    skip = ["_be.exe", "_eac.exe", "launcher", "unins", "crash", "report", "update", "setup", "install"]
    for exe in game.get("executables", []):
        if exe.get("os") != "win32":
            continue
        name = exe.get("name", "").lstrip(">").replace("\\", "/")
        if any(s in name.lower() for s in skip):
            continue
        if name:
            return name.split("/")[-1]
    return None

# ====================== ФЕЙКЕР ======================
class Faker:
    def __init__(self):
        self.desktop = Path.home() / "Desktop"
        self.out_dir = self.desktop / FAKE_EXE_DIR
        self.out_dir.mkdir(exist_ok=True)

        if getattr(sys, "frozen", False):
            self.base = Path(sys.executable)
        else:
            self.base = Path(sys.executable).parent / "pythonw.exe"
            if not self.base.exists():
                self.base = Path(sys.executable)

    def create(self, exe_name: str):
        if not exe_name.lower().endswith(".exe"):
            exe_name += ".exe"
        target = self.out_dir / Path(exe_name).name
        try:
            shutil.copy2(self.base, target)
            p(f"[OK] Создан: {target}", C.GREEN, True)
            return target
        except Exception as e:
            p(f"[ERROR] Не удалось создать файл: {e}", C.RED, True)
            return None

    def launch(self, path: Path):
        try:
            DETACHED = 0x00000008
            subprocess.Popen(
                [str(path)],
                creationflags=DETACHED,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                stdin=subprocess.DEVNULL
            )
            p("[OK] Процесс запущен в фоне", C.GREEN, True)
            p("[!] Discord должен быть запущен!", C.YELLOW)
            p("[*] Оставьте процесс работать нужное время (обычно 15 минут)", C.CYAN)
            return True
        except Exception as e:
            p(f"[!] Ошибка запуска: {e}", C.YELLOW)
            return False

# ====================== ГЛАВНОЕ МЕНЮ ======================
def main():
    banner()
    games = load_games()
    if not games:
        input("\nНажмите Enter для выхода...")
        return

    faker = Faker()

    while True:
        banner()
        p(f"База: {len(games)} игр  |  Папка: Desktop\\{FAKE_EXE_DIR}", C.GRAY)
        print()
        p("1. Поиск игры в базе Discord", C.GREEN)
        p("2. Ручной ввод имени .exe", C.GREEN)
        p("3. Выход", C.RED)
        print()

        choice = input(f"{C.BOLD}Выбор [1-3]: {C.RESET}").strip()

        if choice == "1":
            query = input(f"\n{C.BOLD}Поиск (например Roblox): {C.RESET}").strip()
            if not query or query.lower() in ("back", "b", "назад"):
                continue

            matches = search_games(games, query)[:12]
            if not matches:
                p("Ничего не найдено", C.RED)
                time.sleep(1.5)
                continue

            print()
            for i, g in enumerate(matches, 1):
                print(f"  {C.CYAN}{i:2d}.{C.RESET} {g.get('name')}")
            print()

            sel = input(f"{C.BOLD}Номер: {C.RESET}").strip()
            try:
                game = matches[int(sel) - 1]
            except Exception:
                continue

            exe = get_exe(game)
            if not exe:
                p("Подходящий Windows .exe не найден. Введите вручную:", C.YELLOW)
                exe = input("Имя .exe: ").strip()
                if not exe:
                    continue

            p(f"\nИгра : {game.get('name')}", C.CYAN)
            p(f"Exe  : {exe}", C.GREEN)

            if input("\nСоздать и запустить? [Y/n]: ").strip().lower() not in ("", "y", "yes", "д", "да"):
                continue

            path = faker.create(exe)
            if path:
                faker.launch(path)

            input("\nНажмите Enter...")

        elif choice == "2":
            exe = input(f"\n{C.BOLD}Имя .exe (например RobloxPlayerBeta.exe): {C.RESET}").strip()
            if not exe:
                continue
            path = faker.create(exe)
            if path:
                faker.launch(path)
            input("\nНажмите Enter...")

        elif choice == "3":
            p("\nДо встречи! Будьте осторожны. ❤\ufe0f", C.MAGENTA)
            break

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        p("\n\nОстановлено", C.YELLOW)
