#!/usr/bin/env node

//comprehensive test script for blog publishing functionality
//tests both database operations and API endpoints to ensure publishing works correctly

import { db } from '../src/lib/db/queries.js';

class BlogPublishingTester {
  constructor() {
    this.testResults = [];
    this.cleanupIds = [];
  }

  async runAllTests() {
    console.log('🧪 Testing Blog Publishing Functionality\n');
    console.log('='.repeat(50));

    try {
      await this.testDatabasePublishing();
      await this.testAPIPublishing();
      await this.testPublishedPostQueries();
      await this.testPublishingWorkflow();
      
      await this.cleanup();
      this.printResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      await this.cleanup();
      process.exit(1);
    }
  }

  async testDatabasePublishing() {
    console.log('\n📊 Testing Database Publishing Logic...\n');

    //test creating a published post
    await this.runTest('Create Published Post', async () => {
      const postData = {
        title: 'Test Published Post',
        slug: 'test-published-post-' + Date.now(),
        content: 'This is a test post that should be published immediately.',
        status: 'published',
        featured: false,
        allow_comments: true,
        category_ids: [],
        tag_ids: []
      };

      const result = await db.createBlogPost(postData, 1);
      this.cleanupIds.push(result.id);

      //verify the post has published_at set
      if (!result.published_at) {
        throw new Error('Published post missing published_at timestamp');
      }

      return { 
        id: result.id, 
        published_at: result.published_at,
        status: result.status 
      };
    });

    //test creating a draft then publishing it
    await this.runTest('Draft to Published Workflow', async () => {
      //create draft
      const draftData = {
        title: 'Test Draft Post',
        slug: 'test-draft-post-' + Date.now(),
        content: 'This is a test draft that will be published.',
        status: 'draft',
        featured: false,
        allow_comments: true,
        category_ids: [],
        tag_ids: []
      };

      const draft = await db.createBlogPost(draftData, 1);
      this.cleanupIds.push(draft.id);

      //verify draft has no published_at
      if (draft.published_at) {
        throw new Error('Draft post should not have published_at timestamp');
      }

      //update to published
      await db.updateBlogPost(draft.id, { status: 'published' });

      //verify published post now has published_at
      const published = await db.getBlogPostById(draft.id);
      if (!published.published_at) {
        throw new Error('Published post missing published_at after update');
      }

      return {
        draft_published_at: draft.published_at,
        published_published_at: published.published_at,
        status_changed: draft.status !== published.status
      };
    });

    //test published back to draft
    await this.runTest('Published to Draft Workflow', async () => {
      //create published post
      const publishedData = {
        title: 'Test Published to Draft',
        slug: 'test-published-to-draft-' + Date.now(),
        content: 'This post will be unpublished.',
        status: 'published',
        featured: false,
        allow_comments: true,
        category_ids: [],
        tag_ids: []
      };

      const published = await db.createBlogPost(publishedData, 1);
      this.cleanupIds.push(published.id);

      //change back to draft
      await db.updateBlogPost(published.id, { status: 'draft' });

      //verify draft has published_at cleared
      const draft = await db.getBlogPostById(published.id);
      if (draft.published_at !== null) {
        throw new Error('Draft post should have published_at cleared');
      }

      return {
        original_published_at: published.published_at,
        draft_published_at: draft.published_at,
        status_reverted: draft.status === 'draft'
      };
    });
  }

  async testAPIPublishing() {
    console.log('\n🌐 Testing API Publishing Endpoints...\n');

    const baseUrl = 'http://localhost:4321';

    //test creating published post via API
    await this.runTest('API Create Published Post', async () => {
      const formData = new FormData();
      formData.append('title', 'API Test Published Post');
      formData.append('slug', 'api-test-published-' + Date.now());
      formData.append('content', 'This post was created via API and should be published.');
      formData.append('status', 'published');
      formData.append('featured', 'off');

      const response = await fetch(`${baseUrl}/api/admin/blog`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`API request failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error('API returned success: false');
      }

      //get the created post to verify published_at
      const postResponse = await fetch(`${baseUrl}/api/admin/blog/${result.id}`);
      const postData = await postResponse.json();

      if (!postData.published_at) {
        throw new Error('API created post missing published_at');
      }

      this.cleanupIds.push(result.id);
      return { id: result.id, published: !!postData.published_at };
    });

    //test updating post status via API
    await this.runTest('API Update Post Status', async () => {
      //first create a draft via API
      const formData = new FormData();
      formData.append('title', 'API Test Draft');
      formData.append('slug', 'api-test-draft-' + Date.now());
      formData.append('content', 'This draft will be published via API.');
      formData.append('status', 'draft');

      const createResponse = await fetch(`${baseUrl}/api/admin/blog`, {
        method: 'POST',
        body: formData
      });

      const createResult = await createResponse.json();
      this.cleanupIds.push(createResult.id);

      //now update to published
      const updateFormData = new FormData();
      updateFormData.append('title', 'API Test Draft');
      updateFormData.append('slug', 'api-test-draft-' + Date.now());
      updateFormData.append('content', 'This draft will be published via API.');
      updateFormData.append('status', 'published');

      const updateResponse = await fetch(`${baseUrl}/api/admin/blog/${createResult.id}`, {
        method: 'PUT',
        body: updateFormData
      });

      if (!updateResponse.ok) {
        throw new Error(`Update failed: ${updateResponse.status}`);
      }

      //verify the post is now published with published_at
      const verifyResponse = await fetch(`${baseUrl}/api/admin/blog/${createResult.id}`);
      const verifyData = await verifyResponse.json();

      if (verifyData.status !== 'published') {
        throw new Error('Post status not updated to published');
      }

      if (!verifyData.published_at) {
        throw new Error('Updated post missing published_at timestamp');
      }

      return { 
        status_updated: true, 
        has_published_at: !!verifyData.published_at 
      };
    });
  }

  async testPublishedPostQueries() {
    console.log('\n🔍 Testing Published Post Queries...\n');

    //test that published posts appear in public queries
    await this.runTest('Published Posts Appear in Public API', async () => {
      //create a published post
      const publishedData = {
        title: 'Public Query Test Post',
        slug: 'public-query-test-' + Date.now(),
        content: 'This post should appear in public queries.',
        status: 'published',
        featured: false,
        allow_comments: true,
        category_ids: [],
        tag_ids: []
      };

      const published = await db.createBlogPost(publishedData, 1);
      this.cleanupIds.push(published.id);

      //query public blog API
      const response = await fetch('http://localhost:4321/api/blog?limit=50');
      const data = await response.json();

      const foundPost = data.data.find(post => post.id === published.id);
      if (!foundPost) {
        throw new Error('Published post not found in public API');
      }

      return { found_in_public_api: true, post_title: foundPost.title };
    });

    //test that draft posts do not appear in public queries
    await this.runTest('Draft Posts Hidden from Public API', async () => {
      //create a draft post
      const draftData = {
        title: 'Draft Query Test Post',
        slug: 'draft-query-test-' + Date.now(),
        content: 'This draft should NOT appear in public queries.',
        status: 'draft',
        featured: false,
        allow_comments: true,
        category_ids: [],
        tag_ids: []
      };

      const draft = await db.createBlogPost(draftData, 1);
      this.cleanupIds.push(draft.id);

      //query public blog API
      const response = await fetch('http://localhost:4321/api/blog?limit=50');
      const data = await response.json();

      const foundPost = data.data.find(post => post.id === draft.id);
      if (foundPost) {
        throw new Error('Draft post incorrectly appears in public API');
      }

      return { hidden_from_public_api: true };
    });
  }

  async testPublishingWorkflow() {
    console.log('\n🔄 Testing Complete Publishing Workflow...\n');

    await this.runTest('Complete Publishing Workflow', async () => {
      const testSlug = 'workflow-test-' + Date.now();
      
      //1. Create draft
      const draftData = {
        title: 'Workflow Test Post',
        slug: testSlug,
        content: 'Testing the complete publishing workflow.',
        status: 'draft',
        featured: false,
        allow_comments: true,
        category_ids: [],
        tag_ids: []
      };

      const draft = await db.createBlogPost(draftData, 1);
      this.cleanupIds.push(draft.id);

      //2. Verify draft not in public API
      let publicResponse = await fetch('http://localhost:4321/api/blog?limit=50');
      let publicData = await publicResponse.json();
      let inPublic = publicData.data.some(post => post.id === draft.id);
      
      if (inPublic) {
        throw new Error('Draft incorrectly appears in public API');
      }

      //3. Publish the post
      await db.updateBlogPost(draft.id, { status: 'published' });

      //4. Verify published post appears in public API
      publicResponse = await fetch('http://localhost:4321/api/blog?limit=50');
      publicData = await publicResponse.json();
      inPublic = publicData.data.some(post => post.id === draft.id);
      
      if (!inPublic) {
        throw new Error('Published post does not appear in public API');
      }

      //5. Verify published_at is set
      const publishedPost = await db.getBlogPostById(draft.id);
      if (!publishedPost.published_at) {
        throw new Error('Published post missing published_at timestamp');
      }

      //6. Change back to draft
      await db.updateBlogPost(draft.id, { status: 'draft' });

      //7. Verify no longer in public API
      publicResponse = await fetch('http://localhost:4321/api/blog?limit=50');
      publicData = await publicResponse.json();
      inPublic = publicData.data.some(post => post.id === draft.id);
      
      if (inPublic) {
        throw new Error('Draft post incorrectly reappears in public API');
      }

      return { workflow_completed: true };
    });
  }

  async runTest(testName, testFunction) {
    const startTime = Date.now();
    
    try {
      console.log(`  📝 Running: ${testName}...`);
      const result = await testFunction();
      
      const duration = Date.now() - startTime;
      this.testResults.push({
        name: testName,
        status: 'passed',
        duration,
        result
      });
      
      console.log(`  ✅ Passed: ${testName} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.push({
        name: testName,
        status: 'failed',
        duration,
        error: error.message
      });
      
      console.log(`  ❌ Failed: ${testName} - ${error.message} (${duration}ms)`);
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test data...\n');
    
    for (const id of this.cleanupIds) {
      try {
        await db.deleteBlogPost(id);
        console.log(`  ✅ Deleted test post ID: ${id}`);
      } catch (error) {
        console.log(`  ⚠️  Could not delete test post ID: ${id} - ${error.message}`);
      }
    }
  }

  printResults() {
    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    const total = this.testResults.length;

    console.log('\n' + '='.repeat(50));
    console.log('📊 BLOG PUBLISHING TEST RESULTS');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Pass Rate: ${Math.round((passed / total) * 100)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => r.status === 'failed')
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.error}`);
        });
    }

    if (failed === 0) {
      console.log('\n🎉 All tests passed! Blog publishing is working correctly.');
    } else {
      console.log(`\n⚠️  ${failed} test(s) failed. Please review and fix issues.`);
    }

    console.log('='.repeat(50));
  }
}

//run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new BlogPublishingTester();
  tester.runAllTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

export { BlogPublishingTester };