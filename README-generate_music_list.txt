Setup the generate_music_list.py script:

python3 -m venv env
source env/bin/activate
pip install tinytag
pip3 install mutagen

python generate_music_list.py /Volumes/DJ-Disk-2025/DJ-Total-Kaos-EDM-Bangers-Only -o tracklist.csv
