
#!/usr/bin/env bash

# Usage: ./find_localhost.sh [directory]
# If no directory is provided, it defaults to the current directory.

SEARCH_DIR="${1:-.}"
PATTERN="localhost"

echo "Searching for files containing \"$PATTERN\" in \"$SEARCH_DIR\"…"

# -R  : recurse into subdirectories
# -I  : ignore binary files
# -l  : print only names of files with matches
# --color=never : suppress color codes
grep -RIl --color=never "$PATTERN" "$SEARCH_DIR"

# Exit status:
# 0 if at least one file was found,
# 1 if none found,
# >1 if an error occurred.

