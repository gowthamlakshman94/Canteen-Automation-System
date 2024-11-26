#!/bin/bash

# Define the directory to search and replace
target_dir="./"  # Update this path as needed

# Define the strings to search and replace
search_string="localhost"
replace_string="localhost"

# Find and replace occurrences in all files within the directory
find "$target_dir" -type f -exec sed -i "s/$search_string/$replace_string/g" {} +

echo "All instances of '$search_string' have been replaced with '$replace_string' in the folder: $target_dir"
