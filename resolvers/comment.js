const Mutation = {
  /**
   * Creates a post comment
   * @param {string} image
   * @param {string} comment
   * @param {string} author author id
   * @param {string} postId
   */
  createComment: async (
    root,
    { input: { image, comment, author, postId } },
    { Comment, Post, User }
  ) => {
    let imageUrl, imagePublicId;
    if (image) {
      const { createReadStream } = await image;
      const stream = createReadStream();
      const uploadImage = await uploadToCloudinary(stream, 'post');

      if (!uploadImage.secure_url) {
        throw new Error(
          'Something went wrong while uploading image to Cloudinary'
        );
      }

      let optimizedImage = uploadImage.secure_url.replace('/upload/', '/upload/f_auto,q_auto/'); 
      imageUrl = await optimizedImage;
      imagePublicId = uploadImage.public_id;
    }

    const newComment = await new Comment({
      image: imageUrl,
      imagePublicId,
      comment,
      author,
      post: postId,
    }).save();


    // Push comment to post collection
    await Post.findOneAndUpdate(
      { _id: postId },
      { $push: { comments: newComment.id } }
    );
    // Push comment to user collection
    await User.findOneAndUpdate(
      { _id: author },
      {
        $push: { comments: newComment.id },
      }
    );

    return newComment;
  },

  editComment: async (
    root,
    { id, input: { image, comment, author, postId } },
    { Comment, Post, User }
  ) => {
    let imageUrl, imagePublicId;
    const now = Date.now();
    if (image) {
      const { createReadStream } = await image;
      const stream = createReadStream();
      const uploadImage = await uploadToCloudinary(stream, 'post');

      if (!uploadImage.secure_url) {
        throw new Error(
          'Something went wrong while uploading image to Cloudinary'
        );
      }

      let optimizedImage = uploadImage.secure_url.replace('/upload/', '/upload/f_auto,q_auto/'); 
      imageUrl = await optimizedImage;
      imagePublicId = uploadImage.public_id;
    }

    let updatedComment = await Comment.findOneAndUpdate(
      { _id: id },
      {
        comment,
        image: imageUrl,
        imagePublicId: imagePublicId,
        updatedAt: now
      },
      { new: true }
    );

    // Push comment to post collection
    await Post.findOneAndUpdate(
      { _id: postId },
      { $push: { comments: updatedComment.id } }
    );
    // Push comment to user collection
    await User.findOneAndUpdate(
      { _id: author },
      {
        $push: { comments: updatedComment.id },
      }
    );

    return updatedComment;
  },
  /**
   * Deletes a post comment
   *
   * @param {string} id
   */
  deleteComment: async (
    root,
    { input: { id, imagePublicId } },
    { Comment, User, Post }
  ) => {
    // Remove comment image from cloudinary, if imagePublicId is present
    if (imagePublicId) {
      const deleteImage = await deleteFromCloudinary(imagePublicId);

      if (deleteImage.result !== 'ok') {
        throw new Error(
          'Something went wrong while deleting image from Cloudinary'
        );
      }
    }
    const comment = await Comment.findByIdAndRemove(id);

    // Delete comment from users collection
    await User.findOneAndUpdate(
      { _id: comment.author },
      {
        $pull: { comments: comment.id }
      }
    );
    // Delete comment from posts collection
    await Post.findOneAndUpdate(
      { _id: comment.post },
      { $pull: { comments: comment.id } }
    );

    return comment;
  },
};

export default { Mutation };
