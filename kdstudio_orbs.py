#!/usr/bin/env python3
"""
KDStudio Discord Orbs Farmer
© KDStudio 2026

Educational purposes only.
This tool creates fake game processes so Discord can detect them by process name.
Use at your own risk. The authors are not responsible for any account actions.
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
    print("Missing dependency: requests")
    print("Install with:  pip install requests")
    input("Press Enter to exit...")
    sys.exit(1)

# ====================== CONFIG ======================
VERSION   = "1.0.0"
DEVELOPER = "KDStudio"
FAKE_EXE_DIR = "Win64"

DISCORD_API   = "https://discord.com/api/v9/applications/detectable"
GITHUB_BACKUP = "https://gist.githubusercontent.com/Cynosphere/c1e77f77f0e565ddaac2822977961e76/raw/gameslist.json"

# ====================== COLORS ======================
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
    {C.GRAY}Educational use only • Use at your own risk{C.RESET}
""")

# ====================== GAME DATABASE ======================
def load_games():
    p("\n[*] Loading Discord detectable games database...", C.YELLOW)
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
        p(f"[OK] Loaded {len(games)} games from official Discord API", C.GREEN, True)
        return games
    except Exception as e:
        p(f"[!] Discord API unavailable: {e}", C.YELLOW)
        p("[*] Trying GitHub backup...", C.CYAN)
        try:
            r = requests.get(GITHUB_BACKUP, timeout=15)
            r.raise_for_status()
            games = r.json()
            p(f"[OK] Loaded {len(games)} games from backup", C.GREEN, True)
            return games
        except Exception as e2:
            p(f"[ERROR] Failed to load database: {e2}", C.RED, True)
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

# ====================== FAKER ======================
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
            p(f"[OK] Created: {target}", C.GREEN, True)
            return target
        except Exception as e:
            p(f"[ERROR] Failed to create file: {e}", C.RED, True)
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
            p("[OK] Process launched in background", C.GREEN, True)
            p("[!] Discord must be running!", C.YELLOW)
            p("[*] Keep the process running for the required time (usually 15 min)", C.CYAN)
            return True
        except Exception as e:
            p(f"[!] Launch error: {e}", C.YELLOW)
            return False

# ====================== MAIN ======================
def main():
    banner()
    games = load_games()
    if not games:
        input("\nPress Enter to exit...")
        return

    faker = Faker()

    while True:
        banner()
        p(f"Database: {len(games)} games  |  Output: Desktop\\{FAKE_EXE_DIR}", C.GRAY)
        print()
        p("1. Search Discord game database", C.GREEN)
        p("2. Manual .exe name", C.GREEN)
        p("3. Exit", C.RED)
        print()

        choice = input(f"{C.BOLD}Select [1-3]: {C.RESET}").strip()

        if choice == "1":
            query = input(f"\n{C.BOLD}Search (e.g. Roblox): {C.RESET}").strip()
            if not query or query.lower() in ("back", "b"):
                continue

            matches = search_games(games, query)[:12]
            if not matches:
                p("Nothing found", C.RED)
                time.sleep(1.5)
                continue

            print()
            for i, g in enumerate(matches, 1):
                print(f"  {C.CYAN}{i:2d}.{C.RESET} {g.get('name')}")
            print()

            sel = input(f"{C.BOLD}Number: {C.RESET}").strip()
            try:
                game = matches[int(sel) - 1]
            except Exception:
                continue

            exe = get_exe(game)
            if not exe:
                p("No suitable Windows executable found. Enter manually:", C.YELLOW)
                exe = input("Executable name: ").strip()
                if not exe:
                    continue

            p(f"\nGame : {game.get('name')}", C.CYAN)
            p(f"Exe  : {exe}", C.GREEN)

            if input("\nCreate and launch? [Y/n]: ").strip().lower() not in ("", "y", "yes"):
                continue

            path = faker.create(exe)
            if path:
                faker.launch(path)

            input("\nPress Enter to continue...")

        elif choice == "2":
            exe = input(f"\n{C.BOLD}Executable name (e.g. RobloxPlayerBeta.exe): {C.RESET}").strip()
            if not exe:
                continue
            path = faker.create(exe)
            if path:
                faker.launch(path)
            input("\nPress Enter to continue...")

        elif choice == "3":
            p("\nGoodbye! Stay safe. ❤\ufe0f", C.MAGENTA)
            break

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        p("\n\nInterrupted", C.YELLOW)
