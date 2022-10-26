@echo off

call conda activate avatarify
set PYTHONPATH=%PYTHONPATH%;%CD%;%CD%/fomm
set KMP_DUPLICATE_LIB_OK=TRUE
call python main.py
