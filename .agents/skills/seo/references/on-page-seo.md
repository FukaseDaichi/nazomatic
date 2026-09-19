## On-page SEO

### Title tags

```html
<!-- ❌ Missing or generic -->
<title>Page</title>
<title>Home</title>

<!-- ✅ Descriptive with primary keyword -->
<title>Blue Widgets for Sale | Premium Quality | Example Store</title>
```

**Title tag guidelines:**
- 50-60 characters (Google truncates ~60)
- Primary keyword near the beginning
- Unique for every page
- Brand name at end (unless homepage)
- Action-oriented when appropriate

### Meta descriptions

```html
<!-- ❌ Missing or duplicate -->
<meta name="description" content="">

<!-- ✅ Compelling and unique -->
<meta name="description" content="Shop premium blue widgets with free shipping. 30-day returns. Rated 4.9/5 by 10,000+ customers. Order today and save 20%.">
```

**Meta description guidelines:**
- 150-160 characters
- Include primary keyword naturally
- Compelling call-to-action
- Unique for every page
- Matches page content

### Heading structure

```html
<!-- ❌ Poor structure -->
<h2>Welcome to Our Store</h2>
<h4>Products</h4>
<h1>Contact Us</h1>

<!-- ✅ Proper hierarchy -->
<h1>Blue Widgets - Premium Quality</h1>
  <h2>Product Features</h2>
    <h3>Durability</h3>
    <h3>Design</h3>
  <h2>Customer Reviews</h2>
  <h2>Pricing</h2>
```

**Heading guidelines:**
- Single `<h1>` per page (the main topic)
- Logical hierarchy (don't skip levels)
- Include keywords naturally
- Descriptive, not generic

### Image SEO

```html
<!-- ❌ Poor image SEO -->
<img src="IMG_12345.jpg">

<!-- ✅ Optimized image -->
<img src="blue-widget-product-photo.webp"
     alt="Blue widget with chrome finish, side view showing control panel"
     width="800"
     height="600"
     loading="lazy">
```

**Image guidelines:**
- Descriptive filenames with keywords
- Alt text describes the image content
- Compressed and properly sized
- WebP/AVIF with fallbacks
- Lazy load below-fold images

### Internal linking

```html
<!-- ❌ Non-descriptive -->
<a href="/products">Click here</a>
<a href="/widgets">Read more</a>

<!-- ✅ Descriptive anchor text -->
<a href="/products/blue-widgets">Browse our blue widget collection</a>
<a href="/guides/widget-maintenance">Learn how to maintain your widgets</a>
```

**Linking guidelines:**
- Descriptive anchor text with keywords
- Link to relevant internal pages
- Reasonable number of links per page
- Fix broken links promptly
- Use breadcrumbs for hierarchy
