#!/usr/bin/env bash

conda activate avatarify
KMP_DUPLICATE_LIB_OK=TRUE
export PYTHONPATH=$PYTHONPATH:$(pwd):$(pwd)/fomm
python main.py
