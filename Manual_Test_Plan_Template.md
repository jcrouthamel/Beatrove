# Manual Test Plan Template

## Project Name: _______________________
## Version: ____________________________
## Tester: _____________________________
## Date: ______________________________

---

## 1. Test Summary
A brief description of what this round of testing covers (features, bug fixes, etc.)

---

## 2. Test Environment
- **Browser(s):**  
- **Operating System:**  
- **Device(s):**  
- **Other Notes:**  

---

## 3. Test Scenarios

| Test Case ID | Feature/Area        | Scenario/Action                                            | Expected Result                        | Pass/Fail | Notes/Defects            |
|--------------|--------------------|------------------------------------------------------------|----------------------------------------|-----------|--------------------------|
| TC-01        | Track Upload       | Upload a valid tracklist file                              | Tracks display in UI                   |           |                          |
| TC-02        | Track Upload       | Upload an invalid/empty file                               | Error message shown                    |           |                          |
| TC-03        | Filtering          | Filter by BPM                                              | Only matching tracks are shown         |           |                          |
| TC-04        | Filtering          | Filter by Key                                              | Only matching tracks are shown         |           |                          |
| TC-05        | Favorites          | Star a track, refresh page                                 | Track remains starred                  |           |                          |
| TC-06        | Show in Folder     | Click folder icon, paste clipboard                         | Path is copied to clipboard            |           |                          |
| TC-07        | Audio Preview      | Load audio files, click preview icon                       | Audio plays for selected track         |           |                          |
| TC-08        | Playlists          | Create a playlist, add/remove tracks                       | Playlist updates as expected           |           |                          |
| TC-09        | Tags               | Add/remove tags, filter by tag                             | Tagging and filtering work             |           |                          |
| TC-10        | Visualizer         | Play audio, observe visualizer                             | Visualizer animates with audio         |           |                          |
| TC-11        | Edge Case          | Upload very large file                                     | App remains responsive                 |           |                          |
| TC-12        | UI/UX              | Hover/click all icons/buttons                              | Tooltips/alerts display correctly      |           |                          |
| ...          | ...                | ...                                                        | ...                                    |           |                          |

---

## 4. Defect Log

| Defect ID | Test Case ID | Description                  | Severity | Status   | Notes           |
|-----------|--------------|------------------------------|----------|----------|-----------------|
| D-01      | TC-07        | Audio preview not working    | High     | Open     | Only on Safari  |
| ...       | ...          | ...                          | ...      | ...      | ...             |

---

## 5. Sign-off
- **Tester Signature:** _____________________
- **Date:** ________________________________
