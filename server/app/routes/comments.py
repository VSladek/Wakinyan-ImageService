from flask import Blueprint, g, jsonify, request

from ..auth import login_required
from ..models import Comment, Image, db

bp = Blueprint("comments", __name__, url_prefix="/api/comments")


@bp.post("/")
@login_required
def add_comment():
    """
    Add a Comment to an Image
    Adds a comment to a specific image.
    ---
    tags:
      - Comments
    security:
      - ApiKeyAuth: []
    parameters:
      - $ref: '#/components/parameters/usernameHeader'
    requestBody:
        description: Comment data
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                image_id:
                  type: integer
                  description: The ID of the image to comment on.
                  example: 123
                content:
                  type: string
                  description: The content of the comment.
                  example: "Great photo!"
    responses:
      404:
        description: Image not found.
      400:
        description: Bad request, content is required.
      200:
        description: Comment added successfully.
        content:
          application/json:
            schema:
              type: object
              properties:
                success:
                  type: boolean
                  example: true
                comment_id:
                  type: integer
                  example: 123
    """
    data = request.get_json(force=True)
    image = Image.query.get_or_404(data.get("image_id"))
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify(error="content required"), 400

    c = Comment(image=image, author=g.current_user, content=content)
    db.session.add(c)
    db.session.commit()
    return jsonify(success=True, comment_id=c.id)


@bp.get("/image/<int:image_id>")
@login_required
def list_comments(image_id):
    """
    List Comments for an Image
    Retrieves all comments for a specific image.
    ---
    tags:
      - Comments
    security:
      - ApiKeyAuth: []
    parameters:
      - $ref: '#/components/parameters/usernameHeader'
      - in: path
        name: image_id
        type: integer
        required: true
        description: The ID of the image to retrieve comments for.
    responses:
      404:
        description: Image not found.
      200:
        description: A list of comments for the image.
        content:
          application/json:
            schema:
              type: object
              properties:
                comments:
                  type: array
                  items:
                    type: object
                    properties:
                      id:
                        type: integer
                        example: 123
                      content:
                        type: string
                        example: "Great photo!"
                      created_at:
                        type: string
                        example: "2024-01-01T12:00:00Z"
                      author:
                        type: string
                        example: "john_doe"
    """
    image = Image.query.get_or_404(image_id)
    return jsonify(
        comments=[
            {
                "id": c.id,
                "content": c.content,
                "created_at": c.created_at.isoformat(),
                "author": c.author.username,
            }
            for c in image.comments
        ]
    )
