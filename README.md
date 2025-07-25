# Wakinyan-ImageService

This is a simple image service for my skaut troop. It has a server that handles the storing of the images and a client that allows for a upload of the images.

> [!WARNING]
> This is a work in progress a lot of features are bound to change.
> The state of this project is just a quick throw together so that we can upload images from our camp.

# Future plans

This project is just a start of a larger infrastructure that i want to build for my troop. Next steps are:

- [ ] Rewrite the server in Zig
- [ ] Proper authentication and authorization using [SkautIS](https://is.skaut.cz/)
- [ ] Add a proper client not this half functional client
- [ ] Build a real website for the troop (since the image service is the pace our image will be stored and uploaded we need a proper website not the broken Wordpress one)

# Installation

## Server

A python server as a v1
Production (venv is required):

```bash
cd server
sh start.sh
```

## Client

A expo (react native) client as a v2 (v1 was also a expo client but i remade it):

1. Build the client (pnpm is required):

```bash
cd client
pnpm install
pnpm run build
```

1.5. Or just download the binary from the releases page.

2. Install the app on your phone:
   - For Android: Use the `apk` file in the `client/build` directory.
   - For iOS: Use the `ipa` file in the `client/build` directory.

# Contributing

If you want to help text me a message on our troop discord server.
You can visit the Swagger page for the server and crate your own client if you don't like the one i made.
[photos.wakinyan.eu](https://photos.wakinyan.eu)

# License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
