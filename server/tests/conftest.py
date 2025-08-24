# Ensure the project root (server directory) is on sys.path so tests can import main and schemas
import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
SERVER_ROOT = os.path.dirname(PROJECT_ROOT)
if SERVER_ROOT not in sys.path:
    sys.path.insert(0, SERVER_ROOT)
