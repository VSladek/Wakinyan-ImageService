import base64
import uuid
from datetime import datetime
from pathlib import Path

from flask import Blueprint, g, jsonify, request, send_file
from werkzeug.utils import secure_filename

from ..auth import admin_required, login_required
from ..models import Album, Image, UserRole, db
from ..utils import save_image

bp = Blueprint("images", __name__, url_prefix="/api/images")


@bp.post("/upload")
@login_required
def upload_image():
    """
    Upload an Image
    Uploads an image to a specific album.
    If uploaded by an Admin, the image is auto-approved.
    If uploaded by a Consumer, the image is marked as 'pending' for review.
    ---
    tags:
      - Images
    security:
      - ApiKeyAuth: []
    consumes:
      - multipart/form-data
    parameters:
      - $ref: '#/components/parameters/usernameHeader'
      - in: formData
        name: album_id
        type: integer
        required: true
        description: The ID of the album to upload to.
      - in: formData
        name: image
        type: file
        required: true
        description: The image file to upload.
    responses:
      200:
        description: Image uploaded successfully or submitted for approval.
        content:
          application/json:
            schema:
              type: object
              properties:
                success:
                  type: boolean
                  example: true
                message:
                  type: string
                  example: "Image uploaded successfully."
      404:
        description: Album not found.
    """
    file = request.files.get("image")
    album_id = request.form.get("album_id")
    if not file or not album_id:
        return jsonify(error="image file & album_id required"), 400

    album = Album.query.get_or_404(int(album_id))
    original = secure_filename(file.filename or "image.bin")
    image_bytes = file.read()
    fname, size = save_image(album.dir_path, original, image_bytes)

    status = 'approved' if g.current_user.role == UserRole.ADMIN else 'pending'

    img = Image(
        filename=fname, original_name=original, album=album,
        uploader_id=g.current_user.id, file_size=size, status=status
    )
    db.session.add(img)
    db.session.commit()
    message = "Image uploaded successfully." if status == 'approved' else "Image submitted for approval."
    return jsonify(success=True, message=message, data={"image_id": img.id, "filename": img.filename})


@bp.get("/album/<int:album_id>")
@login_required
def list_album_images(album_id):
    """
    List Images in an Album
    Retrieves images from a specific album.
    Admins see all images. Consumers only see 'approved' images.
    ---
    tags:
      - Images
    security:
      - ApiKeyAuth: []
    parameters:
      - $ref: '#/components/parameters/usernameHeader'
      - in: path
        name: album_id
        type: integer
        required: true
    responses:
      200:
        description: A list of images in the album.
        content:
          application/json:
            schema:
              type: object
              properties:
                images:
                  type: array
                  items:
                    type: object
                    properties:
                      id:
                        type: integer
                        example: 1
                      filename:
                        type: string
                        example: "image1.jpg"
    """
    query = Image.query.filter_by(album_id=album_id)
    if g.current_user.role == UserRole.CONSUMER:
        query = query.filter_by(status='approved')
    images = query.order_by(Image.upload_date.desc()).all()
    return jsonify(images=[{"id": i.id, "filename": i.filename} for i in images])


@bp.get("/<path:filename>")
def serve_image(filename):
    """
    Serve an Image File
    Serves the raw image file. This endpoint is public and does not require authentication.
    ---
    tags:
      - Images
    parameters:
      - in: path
        name: filename
        type: string
        required: true
    responses:
      200:
        description: The image file.
        content:
          image/jpeg:
            schema:
              format: binary
          image/png:
            schema:
              format: binary
      404:
        description: Image not found.
    """
    img = Image.query.filter_by(filename=filename).first_or_404()
    path = img.album.dir_path / filename
    return send_file(path)


@bp.get("/pending")
@login_required
@admin_required
def list_pending():
    """
    List Pending Images (Admin Only)
    Retrieves all images with a 'pending' status for admin review.
    ---
    tags:
      - Images (Admin)
    security:
      - ApiKeyAuth: []
    parameters:
      - $ref: '#/components/parameters/usernameHeader'
    responses:
      200:
        description: A list of pending images.
        content:
          application/json:
            schema:
              type: object
              properties:
                images:
                  type: array
                  items:
                    type: object
                    properties:
                      id:
                        type: integer
                        example: 1
                      filename:
                        type: string
                        example: "image1.jpg"
    """
    pending = Image.query.filter_by(status='pending').all()
    return jsonify(images=[{"id": i.id, "filename": i.filename} for i in pending])


@bp.post("/<int:image_id>/approve")
@login_required
@admin_required
def approve_image(image_id):
    """
    Approve an Image (Admin Only)
    Changes an image's status from 'pending' to 'approved'.
    ---
    tags:
      - Images (Admin)
    security:
      - ApiKeyAuth: []
    parameters:
      - $ref: '#/components/parameters/usernameHeader'
      - in: path
        name: image_id
        type: integer
        required: true
    responses:
      200:
        description: Image approved successfully.
        content:
          application/json:
            schema:
              type: object
              properties:
                success:
                  type: boolean
                  example: true
    """
    img = Image.query.get_or_404(image_id)
    img.status = 'approved'
    db.session.commit()
    return jsonify(success=True)


@bp.post("/<int:image_id>/reject")
@login_required
@admin_required
def reject_image(image_id):
    """
    Reject an Image (Admin Only)
    Deletes a 'pending' image and its file from the server.
    ---
    tags:
      - Images (Admin)
    security:
      - ApiKeyAuth: []
    parameters:
      - $ref: '#/components/parameters/usernameHeader'
      - in: path
        name: image_id
        type: integer
        required: true
    responses:
      200:
        description: Image rejected and deleted successfully.
        content:
          application/json:
            schema:
              type: object
              properties:
                success:
                  type: boolean
                  example: true
    """
    img = Image.query.get_or_404(image_id)
    (img.album.dir_path / img.filename).unlink(missing_ok=True)
    db.session.delete(img)
    db.session.commit()
    return jsonify(success=True)
