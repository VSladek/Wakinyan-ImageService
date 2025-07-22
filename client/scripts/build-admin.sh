echo "Building Admin App..."
cp admin-app.json app.json
expo build:android --type apk
expo build:ios
echo "Admin build complete!"
