@echo off
echo Creating basic icon file...

:: Create a simple 1x1 pixel PNG (minimal valid PNG)
echo iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg== > temp_b64.txt

:: Decode base64 to create icon.png
certutil -decode temp_b64.txt icon.png > nul 2>&1

:: Clean up
del temp_b64.txt

echo Icon created at assets\icon.png
echo Note: This is a minimal 1x1 pixel icon. For better appearance, replace with a proper 16x16 or 32x32 PNG icon.