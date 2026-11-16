# MiLMMT's tokenizer for mtprobe.js: encode a JSON list of prompts to token ids (no special
# tokens, as QiTV and the model card run it), or decode a JSON list of id lists to text
import json
import os
import sys

from tokenizers import Tokenizer

tokenizer = Tokenizer.from_file(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models', 'mt', 'tokenizer.json'))
mode, payload = sys.argv[1], json.loads(sys.argv[2])
if mode == 'encode':
    print(json.dumps([tokenizer.encode(text, add_special_tokens=False).ids for text in payload]))
else:
    print(json.dumps([tokenizer.decode(ids, skip_special_tokens=True).strip() for ids in payload]))
