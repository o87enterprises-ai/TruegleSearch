import React from 'react';
import { useParams, Link } from 'react-router-dom';
import LegalPage from '../components/LegalPage';
import { getPostBySlug } from '../content/blogPosts.jsx';

/**
 * Single blog article. Accepts an optional `slug` prop so the build-time
 * prerenderer can render a specific post without route matching; the live app
 * falls back to the :slug route param.
 */
const BlogPost = ({ slug: slugProp }) => {
  const params = useParams();
  const slug = slugProp || params.slug;
  const post = getPostBySlug(slug);

  if (!post) {
    return (
      <LegalPage title="Article not found">
        <p>
          We couldn't find that article. Browse all posts on the{' '}
          <Link to="/blog" className="text-blue-400 hover:text-blue-300">
            Truegle Blog
          </Link>
          .
        </p>
      </LegalPage>
    );
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: 'Truegle' },
    publisher: {
      '@type': 'Organization',
      name: 'Truegle',
      url: 'https://truegle.info',
    },
    mainEntityOfPage: `https://truegle.info/blog/${post.slug}`,
  };

  return (
    <LegalPage title={post.title} lastUpdated={post.date}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className="-mt-2 text-xs text-gray-500 font-mono">{post.readingTime}</p>
      {post.body}
      <div className="pt-6 mt-6 border-t border-gray-800">
        <Link to="/blog" className="text-sm text-blue-400 hover:text-blue-300">
          ← All articles
        </Link>
      </div>
    </LegalPage>
  );
};

export default BlogPost;
