#!/usr/bin/env bash

# pkill -9 -f "python -u main.py"
conda activate avatarify
KMP_DUPLICATE_LIB_OK=TRUE
export PYTHONPATH=$PYTHONPATH:$(pwd):$(pwd)/fomm
# nohup python -u main.py avatarify.log 2>&1 
# tail -f avatarify.log
python main.py