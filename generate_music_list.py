#!/usr/bin/env python3

import os
import argparse
import re
import csv
from tinytag import TinyTag
from mutagen.easyid3 import EasyID3
from mutagen.flac import FLAC
from mutagen.id3 import ID3, APIC
from mutagen.mp3 import MP3
import base64

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

def extract_cover_art(filepath, output_dir=None, artist=None, title=None):
    """Extract cover art from audio file and save as image."""
    if not output_dir:
        return None

    try:
        ext = os.path.splitext(filepath)[1].lower()
        artwork_data = None
        image_format = 'jpg'  # default

        if ext == '.mp3':
            # Extract from MP3 using ID3 tags
            try:
                audio = MP3(filepath, ID3=ID3)
                if audio.tags:
                    for tag in audio.tags.getall('APIC'):
                        artwork_data = tag.data
                        # Determine format from MIME type
                        if tag.mime == 'image/jpeg':
                            image_format = 'jpg'
                        elif tag.mime == 'image/png':
                            image_format = 'png'
                        break
            except Exception:
                pass

        elif ext == '.flac':
            # Extract from FLAC
            try:
                audio = FLAC(filepath)
                if audio.pictures:
                    picture = audio.pictures[0]
                    artwork_data = picture.data
                    # Determine format from MIME type
                    if picture.mime == 'image/jpeg':
                        image_format = 'jpg'
                    elif picture.mime == 'image/png':
                        image_format = 'png'
            except Exception:
                pass

        # Save the artwork if found
        if artwork_data:
            # Use simplified naming: Artist - Title.extension
            if artist and title:
                filename = f"{artist} - {title}"
            else:
                # Fallback to original filename without extension
                filename = os.path.splitext(os.path.basename(filepath))[0]

            # Clean filename for filesystem
            filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
            artwork_path = os.path.join(output_dir, f"{filename}.{image_format}")

            # Create output directory if it doesn't exist
            os.makedirs(output_dir, exist_ok=True)

            with open(artwork_path, 'wb') as f:
                f.write(artwork_data)

            return artwork_path

    except Exception as e:
        print(f"Warning: Could not extract artwork from {os.path.basename(filepath)}: {str(e)}")

    return None
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
        write_csv_output(tracks, output_file, include_artwork=extract_artwork)
    else:
        write_text_output(tracks, output_file, include_artwork=extract_artwork)
    
    # Print summary
    print(f"✅ Processed {len(tracks)} tracks")
    print(f"📄 Output written to: {output_file}")
    
    if extract_artwork and artwork_dir:
        artwork_count = sum(1 for track in tracks if track['artwork_path'])
        print(f"🎨 Extracted {artwork_count} cover art images to: {artwork_dir}")
    
    if skipped_files:
        print(f"⚠️  {len(skipped_files)} files with non-standard naming:")
        for skip in skipped_files[:10]:  # Show first 10
            print(f"   {skip}")
        if len(skipped_files) > 10:
            print(f"   ... and {len(skipped_files) - 10} more")

def write_csv_output(tracks, output_file, include_artwork=False):
    """Write tracks to CSV file."""
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        # Header
        if include_artwork:
            writer.writerow(['Artist', 'Title', 'Key', 'BPM', 'Extension', 'Duration', 'Year', 'Path', 'Genre', 'Energy', 'Label', 'Artwork'])
        else:
            writer.writerow(['Artist', 'Title', 'Key', 'BPM', 'Extension', 'Duration', 'Year', 'Path', 'Genre', 'Energy', 'Label'])
        
        for track in tracks:
            row = [
                track['artist'], track['title'], track['key'], track['bpm'],
                track['extension'], track['duration'], track['year'],
                track['path'], track['genre'], track['energy'], track['label']
            ]
            if include_artwork:
                row.append(track['artwork_path'])
            writer.writerow(row)

def write_text_output(tracks, output_file, include_artwork=False):
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
            if include_artwork and track['artwork_path']: 
                parts.append(f"Artwork: {track['artwork_path']}")
            
            f.write(" - ".join(parts) + "\n")

def generate_list(directory, output_file, csv_format=False, extract_artwork=False, artwork_dir=None):
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
                
                # Extract cover art if requested
                artwork_path = None
                if extract_artwork and artwork_dir:
                    artwork_path = extract_cover_art(filepath, artwork_dir, artist, title)
                
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
                    'label': f"{label}" if label else "",
                    'artwork_path': artwork_path if artwork_path else ""
                }
                
                tracks.append(track_data)
    
    # Sort tracks by artist, then title
    tracks.sort(key=lambda x: (x['artist'].lower(), x['title'].lower()))
    
    # Write output
    if csv_format:
        write_csv_output(tracks, output_file, include_artwork=extract_artwork)
    else:
        write_text_output(tracks, output_file, include_artwork=extract_artwork)
    
    # Print summary
    print(f"✅ Processed {len(tracks)} tracks")
    print(f"📄 Output written to: {output_file}")
    
    if extract_artwork and artwork_dir:
        artwork_count = sum(1 for track in tracks if track['artwork_path'])
        print(f"🎨 Extracted {artwork_count} cover art images to: {artwork_dir}")
    
    if skipped_files:
        print(f"⚠️  {len(skipped_files)} files with non-standard naming:")
        for skip in skipped_files[:10]:  # Show first 10
            print(f"   {skip}")
        if len(skipped_files) > 10:
            print(f"   ... and {len(skipped_files) - 10} more")

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

def main():
    parser = argparse.ArgumentParser(
        description="Generate music tracklist from directory with robust format handling",
        epilog="""
Examples:
  %(prog)s /path/to/music
  %(prog)s /path/to/music --csv -o tracklist.csv
  %(prog)s /path/to/music --extract-artwork --artwork-dir ./covers
  %(prog)s /path/to/music --csv --extract-artwork -o full_tracklist.csv

Expected filename format: Artist - Title - Key - BPM.ext
Example: Artbat - Horizon - 8A - 124.wav
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("directory", 
                       help="Root directory containing music files to scan")
    parser.add_argument("-o", "--output", default="music_list.txt", 
                       help="Output file path (default: %(default)s)")
    parser.add_argument("--csv", action="store_true", 
                       help="Output as CSV instead of text format for easier import")
    parser.add_argument("--validate", action="store_true",
                       help="Only process files with correct naming format (skip non-standard files)")
    parser.add_argument("--extract-artwork", action="store_true",
                       help="Extract cover art from audio files (MP3/FLAC supported)")
    parser.add_argument("--artwork-dir", default="artwork",
                       help="Directory to save extracted artwork images (default: %(default)s)")
    
    args = parser.parse_args()
    
    if not os.path.isdir(args.directory):
        print(f"❌ Directory not found: {args.directory}")
        return
    
    # Set up artwork directory if artwork extraction is requested
    artwork_dir = None
    if args.extract_artwork:
        artwork_dir = os.path.abspath(args.artwork_dir)
        print(f"🎨 Cover art will be extracted to: {artwork_dir}")
    
    generate_list(args.directory, args.output, args.csv, args.extract_artwork, artwork_dir)

if __name__ == "__main__":
    main()