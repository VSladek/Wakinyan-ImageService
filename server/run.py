#!/usr/bin/env python
from app import create_app

app = create_app()

if __name__ == "__main__":
    # Werkzeug dev server (debug only). For production run gunicorn as shown below.
    # gunicorn -w 4 -k gevent -b 0.0.0.0:80 'app:create_app()'
    # with HTTPS
    # gunicorn --certfile=fullchain.pem --keyfile=privkey.pem \
    #          -w 4 -k gevent -b 0.0.0.0:443 'app:create_app()'
    app.run(host="0.0.0.0", port=8080, debug=False)
