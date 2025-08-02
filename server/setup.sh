apt update && apt install -y python3 python3-pip python3-venv nginx
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
ln -s nginx.conf /etc/nginx/nginx.conf
systemctl restart nginx
systemctl enable nginx
