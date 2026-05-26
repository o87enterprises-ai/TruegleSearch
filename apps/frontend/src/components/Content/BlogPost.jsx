import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import DOMPurify from 'dompurify';

/**
 * Individual Blog Post Component
 * Displays a single blog post with metadata
 */
const BlogPost = ({ 
  id, 
  title, 
  content, 
  excerpt, 
  author, 
  publishDate, 
  tags = [], 
  published = true,
  className = '' 
}) => {
  const formattedDate = new Date(publishDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <article className={`bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-700 ${className}`}>
      <div className="p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
            <span>By {author}</span>
            <span>{formattedDate}</span>
            {published ? (
              <span className="px-2 py-1 bg-green-900/30 text-green-300 rounded text-xs">
                Published
              </span>
            ) : (
              <span className="px-2 py-1 bg-yellow-900/30 text-yellow-300 rounded text-xs">
                Draft
              </span>
            )}
          </div>
        </div>

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((tag, index) => (
              <span 
                key={index} 
                className="px-3 py-1 bg-gray-700/50 text-gray-300 rounded-full text-xs"
              >
                {tag.trim()}
              </span>
            ))}
          </div>
        )}

        {excerpt && (
          <p className="text-gray-300 mb-4 text-lg">{excerpt}</p>
        )}

        <div className="prose prose-invert max-w-none text-gray-300">
          {content ? (
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
          ) : (
            <p className="text-gray-500 italic">No content available</p>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700">
          <Link 
            to={`/blog/${id}`} 
            className="inline-flex items-center text-cyan-400 hover:text-cyan-300 font-medium"
          >
            Read full article
            <svg 
              className="w-4 h-4 ml-1" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d="M9 5l7 7-7 7"
              ></path>
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
};

BlogPost.propTypes = {
  /** Unique identifier for the post */
  id: PropTypes.string.isRequired,
  /** Title of the blog post */
  title: PropTypes.string.isRequired,
  /** Main content of the blog post */
  content: PropTypes.string,
  /** Short excerpt of the blog post */
  excerpt: PropTypes.string,
  /** Author of the blog post */
  author: PropTypes.string.isRequired,
  /** Publication date */
  publishDate: PropTypes.string.isRequired,
  /** Array of tags for the post */
  tags: PropTypes.arrayOf(PropTypes.string),
  /** Whether the post is published */
  published: PropTypes.bool,
  /** Additional CSS classes */
  className: PropTypes.string,
};

export default BlogPost;