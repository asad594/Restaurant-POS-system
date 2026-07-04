import os
import sys
from pathlib import Path

# If running as packaged EXE, check if we are in/near the workspace and prepend it to sys.path
if getattr(sys, 'frozen', False):
    exe_dir = Path(sys.executable).parent
    external_base = None
    if (exe_dir / 'templates').exists() and (exe_dir / 'manage.py').exists():
        external_base = exe_dir
    elif (exe_dir.parent / 'templates').exists() and (exe_dir.parent / 'manage.py').exists():
        external_base = exe_dir.parent

    if external_base:
        sys.path.insert(0, str(external_base))
        os.environ['EXTERNAL_BASE_DIR'] = str(external_base)

import threading
import time
import webview
from django.core.management import execute_from_command_line

def start_django():
    # Configure Django environments settings
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
    # Run server on localhost:8000 without file autoreloader in separate thread
    execute_from_command_line([sys.argv[0], 'runserver', '127.0.0.1:8000', '--noreload'])

if __name__ == '__main__':
    print("Starting Django backend server...")
    django_thread = threading.Thread(target=start_django, daemon=True)
    django_thread.start()

    # Wait until Django server is up and listening on port 8000
    import socket
    print("Waiting for Django backend server to start...")
    for _ in range(50):
        try:
            with socket.create_connection(("127.0.0.1", 8000), timeout=0.1):
                break
        except OSError:
            time.sleep(0.1)

    print("Launching POS Desktop GUI Window...")
    # Open desktop window wrapping the web UI
    webview.create_window(
        title='FoodHeaven Restaurant POS System',
        url='http://127.0.0.1:8000/',
        width=1280,
        height=800,
        resizable=True,
        min_size=(1024, 768)
    )
    webview.start()
