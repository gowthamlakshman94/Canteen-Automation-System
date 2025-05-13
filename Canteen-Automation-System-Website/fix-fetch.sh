
#!/bin/bash

# This script updates fetch statements using string concatenation with BASE_URL
# and replaces them with template literals using `${BASE_URL}` in all HTML files.

echo "Updating fetch statements in HTML files..."

find . -type f -name "*.html" | while read -r file; do
    echo "Processing: $file"

    # Replace fetch('" + BASE_URL + "/something') with fetch(`${BASE_URL}/something`)
    sed -i -E \
        "s@fetch\('\" \+ BASE_URL \+ \"([^\']*)'@fetch(\`\${BASE_URL}\1\`@g" \
        "$file"
done

echo "✅ Update complete."

