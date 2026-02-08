import csv
import re
import os
import sys

# Get the directory of the script
script_dir = os.path.dirname(os.path.abspath(__file__))
# Assumes the raw text file is in the same directory
input_file = os.path.join(script_dir, "nipponham_raw.txt")
output_file = os.path.join(script_dir, "nipponham_players.csv")

# Position mapping
pos_map = {
    "PITCHER": "P",
    "CATCHER": "C",
    "INFIELDER": "IF",
    "OUTFIELDER": "OF"
}

def parse_nipponham_data(input_path, output_path):
    if not os.path.exists(input_path):
        print(f"Error: Input file not found at {input_path}")
        return

    try:
        with open(input_path, "r", encoding="utf-8") as f:
            lines = [line.strip() for line in f if line.strip()]
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    players = []
    current_pos = None
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Check for position header
        header_match = False
        for key, val in pos_map.items():
            if line.startswith(key):
                current_pos = val
                header_match = True
                break
        
        if header_match:
            i += 1
            # Skip Japanese position line if it exists
            if i < len(lines) and lines[i] in ["投手", "捕手", "内野手", "外野手"]:
                i += 1
            continue

        if line == "お気に入り選手を登録しよう":
            i += 1
            continue

        # Pattern: Name -> Number -> Name (duplicate)
        # Check if CURRENT line is a number? No.
        # Check if NEXT line is a number?
        # Let's iterate.
        # If we see a number line, we assume the previous line was the name.
        
        if re.match(r"^\d+$", line):
            number = line
            if i > 0:
                name = lines[i-1]
                # Validate name
                is_keyword = False
                for k in pos_map:
                    if name.startswith(k): is_keyword = True
                
                if not is_keyword and name != "お気に入り選手を登録しよう":
                    # Append player
                    players.append({
                        "team_id": 5,
                        "name": name,
                        "number": number,
                        "position": current_pos,
                        "hand": ""
                    })
            
            # Skip duplicated name line if present
            # Usually the pattern is Name -> Number -> Name
            # So lines[i] is Number. lines[i+1] might be Name.
            if i + 1 < len(lines) and lines[i+1] == name:
                i += 2 # Skip duplicate line
            else:
                i += 1
        else:
            # Just a name line or garbage
            i += 1

    try:
        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["team_id", "name", "number", "position", "hand"])
            writer.writeheader()
            writer.writerows(players)
        print(f"Successfully wrote {len(players)} players to {output_path}")
    except Exception as e:
        print(f"Error writing CSV: {e}")

if __name__ == "__main__":
    parse_nipponham_data(input_file, output_file)
