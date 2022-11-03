#!/usr/bin/env bash

# pkill -9 -f "python -u main.py"
source $(conda info --base)/etc/profile.d/conda.sh
conda activate avatarify
export PYTHONPATH=$PYTHONPATH:$(pwd):$(pwd)/fomm
export CUDA_VISIBLE_DEVICES=0,1
export KMP_DUPLICATE_LIB_OK=TRUE
# nohup python -u main.py avatarify.log 2>&1 
# tail -f avatarify.log
python main.py
