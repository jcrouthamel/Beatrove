#!/usr/bin/env python3

import os
import argparse
import re
import csv
from tinytag import TinyTag
from mutagen.easyid3 import EasyID3
from mutagen.flac import FLAC

def parse_filename(filename):
    """Parse filename with more flexible matching and validation."""
    name, ext = os.path.splitext(filename)
    
    # Try the expected format first: Artist - Title - Key - BPM
    parts = name.split(" - ")
    
    if len(parts) >= 4:
        artist, title, key, bpm = parts[0], parts[1], parts[2], parts[3]
        
        # Validate BPM is numeric
        bpm_clean = re.sub(r'[^\d.]', '', bpm.strip())
        if bpm_clean and bpm_clean.replace('.', '').isdigit():
            return {
                "artist": artist.strip(),
                "title": title.strip(), 
                "key": key.strip(),
                "bpm": bpm.strip(),
                "ext": ext.lower(),
                "valid_format": True
            }
    
    # If format doesn't match, try to extract from metadata
    return {
        "artist": "",
        "title": name,  # Use full filename as title
        "key": "",
        "bpm": "",
        "ext": ext.lower(),
        "valid_format": False
    }

def format_duration(seconds):
    """Convert seconds to MM:SS format."""
    if seconds is None or seconds <= 0:
        return ""
    m, s = divmod(int(seconds), 60)
    return f"{m}:{s:02}"

def get_custom_fields(filepath):
    """Read custom fields like ENERGYLEVEL and RECORD LABEL using Mutagen."""
    ext = os.path.splitext(filepath)[1].lower()
    energy = ""
    label = ""
    
    try:
        if ext == '.mp3':
            tags = EasyID3(filepath)
            # Try common variations for energy level
            for field in ['energylevel', 'energy_level', 'energy']:
                if field in tags and tags[field] and not energy:
                    energy = tags[field][0]
            
            # Try common variations for record label
            for field in ['label', 'publisher', 'organization']:
                if field in tags and tags[field] and not label:
                    label = tags[field][0]
            
            # Try raw ID3 tags for custom fields
            try:
                from mutagen.id3 import ID3, TXXX
                id3 = ID3(filepath)
                for frame in id3.getall('TXXX'):
                    desc_lower = frame.desc.lower()
                    if not energy and desc_lower in ['energylevel', 'energy_level', 'energy']:
                        energy = frame.text[0] if frame.text else ""
                    if not label and desc_lower in ['record label', 'recordlabel', 'label', 'publisher']:
                        label = frame.text[0] if frame.text else ""
            except:
                pass
                    
        elif ext == '.flac':
            tags = FLAC(filepath)
            if tags and tags.tags:
                # FLAC uses Vorbis comments
                for field in ['energylevel', 'energy_level', 'energy']:
                    field_upper = field.upper()
                    if field_upper in tags.tags and not energy:
                        energy = tags.tags[field_upper][0]
                
                for field in ['label', 'publisher', 'organization', 'record_label', 'recordlabel']:
                    field_upper = field.upper()
                    if field_upper in tags.tags and not label:
                        label = tags.tags[field_upper][0]
                        
    except Exception:
        pass
    
    return energy.strip() if energy else "", label.strip() if label else ""

def get_metadata_from_tags(filepath, parsed_info):
    """Get metadata from file tags, use as fallback for missing filename info."""
    try:
        tag = TinyTag.get(filepath)
        
        # Use tag info as fallback for missing filename data
        artist = parsed_info['artist'] or (tag.artist if tag.artist else "Unknown Artist")
        title = parsed_info['title'] or (tag.title if tag.title else os.path.splitext(os.path.basename(filepath))[0])
        
        duration = format_duration(tag.duration)
        year = str(tag.year)[:4] if tag.year else ""
        genre = tag.genre.strip() if tag.genre else ""
        
        return artist, title, duration, year, genre
        
    except Exception:
        return (parsed_info['artist'] or "Unknown Artist", 
                parsed_info['title'], "", "", "")

def generate_list(directory, output_file, csv_format=False):
    """Generate music list in specified format."""
    tracks = []
    skipped_files = []
    
    for root, _, files in os.walk(directory):
        for filename in files:
            if filename.lower().endswith(('.mp3', '.flac', '.wav', '.aiff', '.aac')):
                filepath = os.path.abspath(os.path.join(root, filename))
                
                # Parse filename
                parsed = parse_filename(filename)
                
                # Get metadata from tags
                artist, title, duration, year, genre = get_metadata_from_tags(filepath, parsed)
                
                # Get custom fields
                energy, label = get_custom_fields(filepath)
                
                # Warn about non-standard format files
                if not parsed['valid_format']:
                    skipped_files.append(f"Non-standard format: {filename}")
                
                # Build track info
                track_data = {
                    'filename': f"{artist} - {title} - {parsed['key']} - {parsed['bpm']}{parsed['ext']}",
                    'artist': artist,
                    'title': title,
                    'key': parsed['key'],
                    'bpm': parsed['bpm'],
                    'extension': parsed['ext'],
                    'duration': duration,
                    'year': year,
                    'path': filepath,
                    'genre': genre,
                    'energy': f"Energy {energy}" if energy else "",
                    'label': f"{label}" if label else ""
                }
                
                tracks.append(track_data)
    
    # Sort tracks by artist, then title
    tracks.sort(key=lambda x: (x['artist'].lower(), x['title'].lower()))
    
    # Write output
    if csv_format:
        write_csv_output(tracks, output_file)
    else:
        write_text_output(tracks, output_file)
    
    # Print summary
    print(f"✅ Processed {len(tracks)} tracks")
    print(f"📄 Output written to: {output_file}")
    
    if skipped_files:
        print(f"⚠️  {len(skipped_files)} files with non-standard naming:")
        for skip in skipped_files[:10]:  # Show first 10
            print(f"   {skip}")
        if len(skipped_files) > 10:
            print(f"   ... and {len(skipped_files) - 10} more")

def write_csv_output(tracks, output_file):
    """Write tracks to CSV file."""
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        # Header
        writer.writerow(['Artist', 'Title', 'Key', 'BPM', 'Extension', 'Duration', 'Year', 'Path', 'Genre', 'Energy', 'Label'])
        
        for track in tracks:
            writer.writerow([
                track['artist'], track['title'], track['key'], track['bpm'],
                track['extension'], track['duration'], track['year'],
                track['path'], track['genre'], track['energy'], track['label']
            ])

def write_text_output(tracks, output_file):
    """Write tracks to text file in your specified format."""
    with open(output_file, 'w', encoding='utf-8') as f:
        for track in tracks:
            parts = [track['filename']]
            if track['duration']: parts.append(track['duration'])
            if track['year']: parts.append(track['year'])
            parts.append(track['path'])
            if track['genre']: parts.append(track['genre'])
            if track['energy']: parts.append(track['energy'])
            if track['label']: parts.append(track['label'])
            
            f.write(" - ".join(parts) + "\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate music tracklist from directory with robust format handling"
    )
    parser.add_argument("directory", help="Root directory containing music files")
    parser.add_argument("-o", "--output", default="music_list.txt", 
                       help="Output file path (default: music_list.txt)")
    parser.add_argument("--csv", action="store_true", 
                       help="Output as CSV instead of text format")
    parser.add_argument("--validate", action="store_true",
                       help="Only process files with correct naming format")
    
    args = parser.parse_args()
    
    generate_list(args.directory, args.output, args.csv)