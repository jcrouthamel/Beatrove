#!/usr/bin/env python3

import os
import re
import argparse
from tinytag import TinyTag

def is_correct_format(filename):
    """Check if filename is already in correct format: Artist - Title - Key - BPM.ext"""
    name, ext = os.path.splitext(filename)
    parts = name.split(' - ')
    
    if len(parts) < 4:
        return False
    
    # The last two parts should be key and BPM
    key = parts[-2].strip()
    bpm = parts[-1].strip()
    
    # Validate key format (like 8A, 12B, etc.)
    if not re.match(r'^\d{1,2}[AB]$', key):
        return False
    
    # Validate BPM format (numeric, typically 80-200)
    bpm_clean = re.sub(r'[^\d.]', '', bpm)
    if not (bpm_clean and bpm_clean.replace('.', '').isdigit()):
        return False
    
    return True

def extract_bpm_key_from_metadata(filepath):
    """Try to extract BPM and key from file metadata."""
    try:
        tag = TinyTag.get(filepath)
        return None, None  # Placeholder - metadata extraction is tagger-dependent
    except:
        return None, None

def analyze_filename_pattern(filename):
    """Analyze what's wrong with the filename and suggest fixes."""
    name, ext = os.path.splitext(filename)
    
    issues = []
    suggestions = []
    
    # Check if it has any BPM pattern
    bpm_match = re.search(r'\b(\d{2,3})\b', name)
    key_match = re.search(r'\b(\d{1,2}[AB])\b', name)
    
    parts = name.split(' - ')
    
    if len(parts) < 2:
        issues.append("Missing artist-title separation")
        suggestions.append("Add ' - ' between artist and title")
    elif len(parts) == 2:
        if not bpm_match and not key_match:
            issues.append("Missing key and BPM")
            suggestions.append("Add ' - KEY - BPM' at the end")
        elif not bpm_match:
            issues.append("Missing BPM")
            suggestions.append("Add BPM after key")
        elif not key_match:
            issues.append("Missing key")
            suggestions.append("Add key before BPM")
    elif len(parts) == 3:
        if not bpm_match:
            issues.append("Missing BPM")
        elif not key_match:
            issues.append("Missing key")
        else:
            issues.append("Has key and BPM but wrong number of segments")
    elif len(parts) >= 4:
        # Check if last two parts are key and BPM (correct format)
        key_part = parts[-2].strip()
        bpm_part = parts[-1].strip()
        
        key_valid = re.match(r'^\d{1,2}[AB]$', key_part)
        bpm_clean = re.sub(r'[^\d.]', '', bpm_part)
        bpm_valid = bpm_clean and bpm_clean.replace('.', '').isdigit()
        
        if key_valid and bpm_valid:
            return [], [], bpm_match, key_match  # Actually correct format
        else:
            if not key_valid:
                issues.append("Invalid key format in expected position")
            if not bpm_valid:
                issues.append("Invalid BPM format in expected position")
    
    return issues, suggestions, bpm_match, key_match

def suggest_rename(filepath, default_key="8A", default_bpm="120"):
    """Suggest a standardized filename."""
    directory = os.path.dirname(filepath)
    filename = os.path.basename(filepath)
    name, ext = os.path.splitext(filename)
    
    # Try to extract metadata first
    try:
        tag = TinyTag.get(filepath)
        meta_artist = tag.artist
        meta_title = tag.title
    except:
        meta_artist = None
        meta_title = None
    
    # Analyze current filename
    issues, suggestions, bpm_match, key_match = analyze_filename_pattern(filename)
    
    parts = name.split(' - ')
    
    # Extract BPM and key if present
    extracted_bpm = bpm_match.group(1) if bpm_match else default_bpm
    extracted_key = key_match.group(1) if key_match else default_key
    
    # Determine artist and title based on file structure
    if len(parts) >= 4:
        # Check if last two parts are key and BPM
        potential_key = parts[-2].strip()
        potential_bpm = parts[-1].strip()
        
        if (re.match(r'^\d{1,2}[AB]$', potential_key) and 
            re.search(r'\d+', potential_bpm)):
            # Last two are key/BPM, everything before is artist and title
            artist = parts[0].strip()
            title_parts = parts[1:-2]  # Everything between artist and key/BPM
            title = ' - '.join(title_parts) if title_parts else "Unknown Title"
            extracted_key = potential_key
            extracted_bpm = re.search(r'\d+', potential_bpm).group()
        else:
            # Fallback to simple parsing
            artist = parts[0].strip()
            title = ' - '.join(parts[1:]).strip()
    elif len(parts) >= 2:
        artist = parts[0].strip()
        title_parts = parts[1:]
        
        # Remove BPM and key patterns from title if they exist
        clean_title_parts = []
        for part in title_parts:
            part = part.strip()
            # Don't remove if it looks like a valid title component
            if not (re.match(r'^\d{1,2}[AB]$', part) or re.match(r'^\d{2,3}$', part)):
                clean_title_parts.append(part)
        
        title = ' - '.join(clean_title_parts) if clean_title_parts else parts[1]
    else:
        # Single part or fallback to metadata
        if meta_artist and meta_title:
            artist = meta_artist
            title = meta_title
        else:
            artist = "Unknown Artist"
            title = name
    
    # Clean up artist and title
    artist = re.sub(r'\s+', ' ', artist).strip()
    title = re.sub(r'\s+', ' ', title).strip()
    
    # Build standardized name - preserve complex titles
    new_name = f"{artist} - {title} - {extracted_key} - {extracted_bpm}{ext}"
    new_path = os.path.join(directory, new_name)
    
    return new_path, issues, suggestions

def process_directory(directory, dry_run=True, default_key="8A", default_bpm="120"):
    """Process all non-standard files in directory."""
    
    renames = []
    errors = []
    
    for root, _, files in os.walk(directory):
        for filename in files:
            if filename.lower().endswith(('.mp3', '.flac', '.wav', '.aiff', '.aac')):
                filepath = os.path.join(root, filename)
                
                # Check if already in correct format
                if is_correct_format(filename):
                    continue  # Skip files already in correct format
                
                # Suggest rename
                try:
                    new_path, issues, suggestions = suggest_rename(filepath, default_key, default_bpm)
                    
                    renames.append({
                        'old_path': filepath,
                        'new_path': new_path,
                        'old_name': filename,
                        'new_name': os.path.basename(new_path),
                        'issues': issues,
                        'suggestions': suggestions
                    })
                    
                except Exception as e:
                    errors.append(f"Error processing {filename}: {str(e)}")
    
    return renames, errors

def apply_renames(renames, confirm_each=True):
    """Apply the suggested renames."""
    applied = 0
    skipped = 0
    
    for rename in renames:
        old_path = rename['old_path']
        new_path = rename['new_path']
        
        print(f"\nOLD: {rename['old_name']}")
        print(f"NEW: {rename['new_name']}")
        print(f"Issues: {', '.join(rename['issues'])}")
        
        if confirm_each:
            response = input("Apply this rename? (y/n/a for all): ").lower()
            if response == 'a':
                confirm_each = False
            elif response != 'y' and response != 'a':
                skipped += 1
                continue
        
        try:
            # Check if target already exists
            if os.path.exists(new_path):
                print(f"⚠️  Target already exists: {new_path}")
                skipped += 1
                continue
                
            os.rename(old_path, new_path)
            print(f"✅ Renamed successfully")
            applied += 1
            
        except Exception as e:
            print(f"❌ Error renaming: {str(e)}")
            skipped += 1
    
    return applied, skipped

def main():
    parser = argparse.ArgumentParser(
        description="Fix music filenames to match 'Artist - Title - Key - BPM.ext' format"
    )
    parser.add_argument("directory", help="Directory containing music files")
    parser.add_argument("--dry-run", action="store_true", default=True,
                       help="Show what would be renamed without making changes")
    parser.add_argument("--apply", action="store_true", 
                       help="Actually apply the renames")
    parser.add_argument("--default-key", default="8A",
                       help="Default key for files missing key info (default: 8A)")
    parser.add_argument("--default-bpm", default="120",
                       help="Default BPM for files missing BPM info (default: 120)")
    parser.add_argument("--auto-yes", action="store_true",
                       help="Don't ask for confirmation on each rename")
    
    args = parser.parse_args()
    
    if not os.path.isdir(args.directory):
        print(f"❌ Directory not found: {args.directory}")
        return
    
    print(f"🔍 Scanning {args.directory} for non-standard music files...")
    
    renames, errors = process_directory(
        args.directory, 
        dry_run=args.dry_run,
        default_key=args.default_key,
        default_bpm=args.default_bpm
    )
    
    if errors:
        print(f"\n❌ Errors encountered:")
        for error in errors:
            print(f"   {error}")
    
    if not renames:
        print("✅ All files are already in correct format!")
        return
    
    print(f"\n📋 Found {len(renames)} files that need renaming:")
    
    if args.dry_run and not args.apply:
        print("\n🔍 DRY RUN - No files will be changed:")
        for i, rename in enumerate(renames[:10], 1):  # Show first 10
            print(f"\n{i}. {rename['old_name']}")
            print(f"   → {rename['new_name']}")
            print(f"   Issues: {', '.join(rename['issues'])}")
        
        if len(renames) > 10:
            print(f"\n... and {len(renames) - 10} more files")
        
        print(f"\nTo apply changes, run with --apply")
        
    elif args.apply:
        print(f"\n🔧 Applying renames...")
        applied, skipped = apply_renames(renames, confirm_each=not args.auto_yes)
        print(f"\n✅ Applied {applied} renames, skipped {skipped}")

if __name__ == "__main__":
    main()