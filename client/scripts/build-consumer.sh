echo "Building Consumer App..."
cp consumer-app.json app.json
expo build:android --type apk
expo build:ios
echo "Consumer build complete!"
