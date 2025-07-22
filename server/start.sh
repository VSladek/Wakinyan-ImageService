gunicorn -w 4 -k gevent -b 0.0.0.0:8080 'app:create_app()'
# with HTTPS
# gunicorn --certfile=fullchain.pem --keyfile=privkey.pem \
#          -w 4 -k gevent -b 0.0.0.0:443 'app:create_app()'
