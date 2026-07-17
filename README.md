# KDStudio Discord Orbs Farmer

**Educational / Research Tool**  
© KDStudio 2026

> **This project is created strictly for educational and research purposes.**  
> It demonstrates how Discord detects running games through process names and how process spoofing techniques work on Windows.  
> **Use at your own risk.** The authors do not encourage violation of Discord's Terms of Service.

---

## ⚠️ Important Disclaimer

- This software is provided **for educational purposes only**.
- Using automation or process spoofing may violate Discord's Terms of Service.
- You are solely responsible for any consequences (including account restrictions).
- The developers of KDStudio and this repository take **no responsibility** for any bans, suspensions, or other actions taken by Discord.
- Do not use this tool for commercial purposes or large-scale farming.

By downloading or using this software you agree that you understand the risks.

---

## What is this?

**KDStudio Discord Orbs Farmer** is a lightweight Windows tool that creates fake game processes.  
Discord detects games by looking at the names of running processes. This tool simply creates a process with the exact name Discord expects for a specific game.

It does **not**:
- Inject code into Discord
- Modify Discord client files
- Send fake network requests to Discord API from inside the client
- Require any client mods (Vencord, BetterDiscord, etc.)

It only creates a renamed process on your system.

---

## Features

- Pulls the latest list of detectable games from Discord's official API
- Fallback to public GitHub backup if API is unavailable
- Search games by name or abbreviation
- Manual mode (type any .exe name)
- Creates fake processes on your Desktop\Win64 folder
- Multiple games can run at the same time
- Clean, colored terminal interface
- Ready to be compiled into a single `.exe` (no Python needed after build)

---

## Requirements

- Windows 10 / 11
- Python 3.9+ (only needed to run from source or to build the .exe)
- Internet connection (to download the game list)

---

## Quick Start (from source)

```bash
git clone https://github.com/KorsDubStudio/discord-orbs-farmer.git
cd discord-orbs-farmer
pip install -r requirements.txt
python kdstudio_orbs.py
```

---

## Build standalone .exe (recommended)

This way the tool will work on any Windows PC without Python installed.

```bash
pip install -r requirements.txt pyinstaller
pyinstaller --onefile --noconsole --name "KDStudio_Orbs" kdstudio_orbs.py
```

After building you will find the file here:

```
dist/KDStudio_Orbs.exe
```

You can copy this single file anywhere and run it.

---

## How to use

1. Make sure **Discord is running**.
2. Start `KDStudio_Orbs.exe` (or `python kdstudio_orbs.py`).
3. Choose option **1** to search the Discord game database.
4. Type the name of the game (example: `Roblox`, `Fortnite`, `Valorant`).
5. Select the correct game from the list.
6. Confirm creation of the fake process.
7. Leave the process running for the required time (usually 15 minutes).
8. You can launch multiple games at once by repeating the process.

The fake executables are placed in:

```
%USERPROFILE%\Desktop\Win64\
```

---

## Manual Mode

If the game is not found in the database, choose option **2** and type the exact process name Discord expects (for example `RobloxPlayerBeta.exe`).

---

## Project Structure

```
discord-orbs-farmer/
├── kdstudio_orbs.py      # Main script
├── requirements.txt     # Python dependencies
├── LICENSE              # License + educational disclaimer
├── .gitignore
└── README.md            # This file
```

---

## Educational Purpose

This project exists to help people understand:

- How applications detect running processes on Windows
- How Discord's game activity detection works at a high level
- Basic process creation and renaming techniques
- How public APIs (Discord detectable applications) can be used for research

It is **not** intended as a production farming tool.

---

## License

This project is released under the **GNU GPL v3** license with an additional educational-use notice.  
See the [LICENSE](LICENSE) file for full details.

Commercial use, redistribution for profit, or any malicious use is strictly prohibited.

---

## Credits

- Idea and original research inspired by public process-spoofing techniques
- Developed and maintained by **KDStudio**
- Special thanks to the open-source community

---

**Made with ❤️ by KDStudio**  
Use responsibly. Stay safe.
