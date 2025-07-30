# Plan 6: Portfolio & Credentials System

**Session Goal**: Implement comprehensive portfolio showcase, credentials management, and professional achievement tracking  
**Estimated Time**: 4-5 hours  
**Prerequisites**: Plans 1-5 completed (foundation, layout, blog, admin, and flight system)  

## Development Phase: Professional Portfolio & Achievement System

### Todo List

#### 1. Portfolio Database Operations
- [ ] Implement all portfolio-related database queries in DatabaseQueries class
- [ ] Create portfolio project CRUD operations with comprehensive metadata
- [ ] Build project categorization and technology tagging system
- [ ] Implement project gallery and media management
- [ ] Create project timeline and status tracking
- [ ] Set up project analytics and view counting
- [ ] Add client testimonials and project reviews
- [ ] Test all portfolio database operations thoroughly

#### 2. Credentials & Education System
- [ ] Create education history management (degrees, courses, certifications)
- [ ] Implement skills assessment and proficiency tracking
- [ ] Build certification and achievement system
- [ ] Create work experience and career timeline
- [ ] Set up professional references and recommendations
- [ ] Add language proficiency tracking
- [ ] Implement volunteer work and community involvement
- [ ] Create awards and recognition system

#### 3. Portfolio API Endpoints
- [ ] Create GET /api/portfolio for paginated project listing
- [ ] Implement GET /api/portfolio/[slug] for individual project details
- [ ] Build POST/PUT/DELETE endpoints for admin project management
- [ ] Create GET /api/portfolio/featured for homepage showcase
- [ ] Implement project search and filtering by technology/category
- [ ] Add related projects recommendation API
- [ ] Create portfolio analytics and metrics endpoints
- [ ] Build project export functionality (PDF, JSON)

#### 4. Professional Showcase Pages
- [ ] Build main portfolio page with project grid and filtering
- [ ] Create individual project detail pages with full case studies
- [ ] Implement about/resume page with comprehensive profile
- [ ] Build skills and expertise showcase with visual indicators
- [ ] Create work experience timeline with interactive elements
- [ ] Add education and certifications display
- [ ] Implement testimonials and recommendations section
- [ ] Build downloadable resume/CV generation

#### 5. Project Case Study System
- [ ] Create rich project documentation editor
- [ ] Implement before/after comparison galleries
- [ ] Build technical challenge and solution documentation
- [ ] Add project metrics and success indicators
- [ ] Create client collaboration and feedback system
- [ ] Implement project technology deep-dive sections
- [ ] Add development process and methodology showcase
- [ ] Build lessons learned and retrospective sections

#### 6. Visual Portfolio Components
- [ ] Build interactive project cards with hover effects
- [ ] Create technology badge system with visual indicators
- [ ] Implement project status indicators and progress bars
- [ ] Build image galleries with lightbox functionality
- [ ] Create animated skill progress indicators
- [ ] Add interactive timeline components
- [ ] Implement project comparison and filtering tools
- [ ] Build responsive grid layouts for all screen sizes

#### 7. Professional Networking Features
- [ ] Create social media integration and sharing
- [ ] Build contact form with project inquiry routing
- [ ] Implement professional profile export (LinkedIn format)
- [ ] Add collaboration request and availability status
- [ ] Create professional calendar integration
- [ ] Build networking event and conference tracking
- [ ] Implement professional goal setting and tracking
- [ ] Add industry involvement and community participation

#### 8. Analytics & Performance Tracking
- [ ] Build comprehensive portfolio analytics dashboard
- [ ] Track project view counts and engagement metrics
- [ ] Implement visitor behavior analysis on portfolio pages
- [ ] Create conversion tracking for project inquiries
- [ ] Add A/B testing for portfolio presentation
- [ ] Build performance optimization for media-heavy pages
- [ ] Implement SEO optimization for project discoverability
- [ ] Create automated portfolio health reports

## Detailed Implementation Steps

### Step 1: Portfolio Database Schema Extensions (75 minutes)

**Extended Portfolio Tables** (add to database/schema.sql):
```sql
-- Education and credentials tables
CREATE TABLE education (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    institution TEXT NOT NULL,
    degree_type TEXT NOT NULL, -- 'bachelor', 'master', 'phd', 'certification', 'bootcamp'
    field_of_study TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    current_status BOOLEAN DEFAULT FALSE,
    gpa DECIMAL(3,2),
    honors TEXT, -- JSON array of honors/awards
    description TEXT,
    relevant_coursework TEXT, -- JSON array
    thesis_title TEXT,
    advisor_name TEXT,
    certificate_url TEXT,
    verification_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Professional experience
CREATE TABLE work_experience (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    position_title TEXT NOT NULL,
    employment_type TEXT DEFAULT 'full-time', -- 'full-time', 'part-time', 'contract', 'freelance', 'internship'
    location TEXT,
    remote_work BOOLEAN DEFAULT FALSE,
    start_date DATE NOT NULL,
    end_date DATE,
    current_position BOOLEAN DEFAULT FALSE,
    description TEXT NOT NULL,
    key_achievements TEXT, -- JSON array
    technologies_used TEXT, -- JSON array
    team_size INTEGER,
    reporting_structure TEXT,
    salary_range TEXT,
    company_size TEXT, -- 'startup', 'small', 'medium', 'large', 'enterprise'
    industry TEXT,
    company_website TEXT,
    references TEXT, -- JSON array with contact info
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Skills and proficiency
CREATE TABLE skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL, -- 'programming', 'framework', 'database', 'tool', 'soft-skill', 'language'
    proficiency_level INTEGER CHECK (proficiency_level BETWEEN 1 AND 5), -- 1=Beginner, 5=Expert
    years_experience DECIMAL(3,1),
    last_used_date DATE,
    certification_level TEXT,
    projects_count INTEGER DEFAULT 0,
    description TEXT,
    learning_resources TEXT, -- JSON array
    endorsements_count INTEGER DEFAULT 0,
    priority_level TEXT DEFAULT 'medium', -- 'high', 'medium', 'low'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Project skills relationship
CREATE TABLE project_skills (
    project_id INTEGER NOT NULL,
    skill_id INTEGER NOT NULL,
    usage_level TEXT DEFAULT 'primary', -- 'primary', 'secondary', 'minor'
    PRIMARY KEY (project_id, skill_id),
    FOREIGN KEY (project_id) REFERENCES portfolio_projects(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

-- Certifications and achievements
CREATE TABLE certifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    issuing_organization TEXT NOT NULL,
    issue_date DATE NOT NULL,
    expiration_date DATE,
    credential_id TEXT,
    credential_url TEXT,
    verification_url TEXT,
    badge_image_url TEXT,
    description TEXT,
    skills_demonstrated TEXT, -- JSON array
    continuing_education_required BOOLEAN DEFAULT FALSE,
    renewal_requirements TEXT,
    industry_recognition TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Client testimonials and recommendations
CREATE TABLE testimonials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT NOT NULL,
    client_position TEXT,
    client_company TEXT,
    client_email TEXT,
    client_linkedin TEXT,
    project_id INTEGER,
    testimonial_text TEXT NOT NULL,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    date_given DATE NOT NULL,
    permission_to_display BOOLEAN DEFAULT TRUE,
    permission_to_contact BOOLEAN DEFAULT FALSE,
    featured BOOLEAN DEFAULT FALSE,
    testimonial_type TEXT DEFAULT 'project', -- 'project', 'general', 'skill-specific'
    work_relationship TEXT, -- 'client', 'colleague', 'supervisor', 'subordinate'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES portfolio_projects(id) ON DELETE SET NULL
);

-- Project case study components
CREATE TABLE case_study_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    section_type TEXT NOT NULL, -- 'challenge', 'solution', 'process', 'outcome', 'lessons'
    section_title TEXT NOT NULL,
    section_content TEXT NOT NULL,
    section_order INTEGER NOT NULL,
    media_items TEXT, -- JSON array of images/videos
    code_examples TEXT, -- JSON array
    metrics TEXT, -- JSON object with performance metrics
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES portfolio_projects(id) ON DELETE CASCADE
);

-- Performance indexes for portfolio queries
CREATE INDEX idx_portfolio_projects_status ON portfolio_projects(status);
CREATE INDEX idx_portfolio_projects_featured ON portfolio_projects(featured);
CREATE INDEX idx_portfolio_projects_project_type ON portfolio_projects(project_type);
CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_proficiency ON skills(proficiency_level DESC);
CREATE INDEX idx_work_experience_current ON work_experience(current_position);
CREATE INDEX idx_certifications_expiration ON certifications(expiration_date);
```

**Extended Database Queries** (add to lib/db/queries.ts):
```typescript
// Add to existing DatabaseQueries class
export class DatabaseQueries {
  // ... existing methods

  // Portfolio project management
  async createProject(projectData: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> {
    const result = await this.db.execute({
      sql: `INSERT INTO portfolio_projects (
        slug, title, short_description, long_description, featured_image,
        gallery_images, tech_stack, project_url, github_url, demo_video_url,
        case_study_url, status, featured, project_type, start_date, end_date,
        client_name, collaboration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        projectData.slug, projectData.title, projectData.short_description,
        projectData.long_description, projectData.featured_image,
        JSON.stringify(projectData.gallery_images || []),
        JSON.stringify(projectData.tech_stack || []),
        projectData.project_url, projectData.github_url, projectData.demo_video_url,
        projectData.case_study_url, projectData.status, projectData.featured,
        projectData.project_type, projectData.start_date, projectData.end_date,
        projectData.client_name, projectData.collaboration
      ]
    });

    return this.getProjectById(result.lastInsertRowid as number);
  }

  async getProjectById(id: number): Promise<Project | null> {
    const result = await this.db.execute({
      sql: `SELECT p.*,
              GROUP_CONCAT(s.name) as skills_used,
              COUNT(t.id) as testimonial_count
            FROM portfolio_projects p
            LEFT JOIN project_skills ps ON p.id = ps.project_id
            LEFT JOIN skills s ON ps.skill_id = s.id
            LEFT JOIN testimonials t ON p.id = t.project_id AND t.permission_to_display = TRUE
            WHERE p.id = ?
            GROUP BY p.id`,
      args: [id]
    });

    if (result.rows.length === 0) return null;
    
    const project = result.rows[0] as any;
    return {
      ...project,
      gallery_images: JSON.parse(project.gallery_images || '[]'),
      tech_stack: JSON.parse(project.tech_stack || '[]'),
      skills_used: project.skills_used ? project.skills_used.split(',') : []
    };
  }

  async getPortfolioProjects(page = 1, limit = 12, filters?: {
    category?: string;
    technology?: string;
    status?: string;
    featured?: boolean;
  }): Promise<PaginatedResponse<Project>> {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const args: any[] = [];

    if (filters?.category) {
      whereClause += ' AND p.project_type = ?';
      args.push(filters.category);
    }

    if (filters?.technology) {
      whereClause += ' AND p.tech_stack LIKE ?';
      args.push(`%"${filters.technology}"%`);
    }

    if (filters?.status) {
      whereClause += ' AND p.status = ?';
      args.push(filters.status);
    }

    if (filters?.featured !== undefined) {
      whereClause += ' AND p.featured = ?';
      args.push(filters.featured);
    }

    const [projectsResult, countResult] = await Promise.all([
      this.db.execute({
        sql: `SELECT p.*,
                GROUP_CONCAT(DISTINCT s.name) as skills_used,
                COUNT(DISTINCT t.id) as testimonial_count
              FROM portfolio_projects p
              LEFT JOIN project_skills ps ON p.id = ps.project_id
              LEFT JOIN skills s ON ps.skill_id = s.id
              LEFT JOIN testimonials t ON p.id = t.project_id AND t.permission_to_display = TRUE
              ${whereClause}
              GROUP BY p.id
              ORDER BY p.featured DESC, p.end_date DESC, p.created_at DESC
              LIMIT ? OFFSET ?`,
        args: [...args, limit, offset]
      }),
      this.db.execute({
        sql: `SELECT COUNT(*) as count FROM portfolio_projects p ${whereClause}`,
        args
      })
    ]);

    const projects = projectsResult.rows.map((row: any) => ({
      ...row,
      gallery_images: JSON.parse(row.gallery_images || '[]'),
      tech_stack: JSON.parse(row.tech_stack || '[]'),
      skills_used: row.skills_used ? row.skills_used.split(',') : []
    }));

    const total = (countResult.rows[0] as any).count;
    const totalPages = Math.ceil(total / limit);

    return {
      data: projects,
      total,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    };
  }

  // Skills management
  async createSkill(skillData: Omit<Skill, 'id' | 'created_at' | 'updated_at'>): Promise<Skill> {
    const result = await this.db.execute({
      sql: `INSERT INTO skills (
        name, category, proficiency_level, years_experience, last_used_date,
        certification_level, description, priority_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        skillData.name, skillData.category, skillData.proficiency_level,
        skillData.years_experience, skillData.last_used_date,
        skillData.certification_level, skillData.description, skillData.priority_level
      ]
    });

    return this.getSkillById(result.lastInsertRowid as number);
  }

  async getAllSkills(category?: string): Promise<Skill[]> {
    let whereClause = '';
    const args: any[] = [];

    if (category) {
      whereClause = 'WHERE category = ?';
      args.push(category);
    }

    const result = await this.db.execute({
      sql: `SELECT * FROM skills ${whereClause}
            ORDER BY priority_level DESC, proficiency_level DESC, name ASC`,
      args
    });

    return result.rows.map((row: any) => ({
      ...row,
      learning_resources: JSON.parse(row.learning_resources || '[]')
    }));
  }

  async getSkillCategories(): Promise<{category: string, count: number}[]> {
    const result = await this.db.execute(`
      SELECT category, COUNT(*) as count
      FROM skills
      GROUP BY category
      ORDER BY count DESC, category ASC
    `);

    return result.rows as any[];
  }

  // Work experience management
  async createWorkExperience(experienceData: Omit<WorkExperience, 'id' | 'created_at' | 'updated_at'>): Promise<WorkExperience> {
    const result = await this.db.execute({
      sql: `INSERT INTO work_experience (
        company_name, position_title, employment_type, location, remote_work,
        start_date, end_date, current_position, description, key_achievements,
        technologies_used, team_size, company_size, industry, company_website
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        experienceData.company_name, experienceData.position_title, experienceData.employment_type,
        experienceData.location, experienceData.remote_work, experienceData.start_date,
        experienceData.end_date, experienceData.current_position, experienceData.description,
        JSON.stringify(experienceData.key_achievements || []),
        JSON.stringify(experienceData.technologies_used || []),
        experienceData.team_size, experienceData.company_size, experienceData.industry,
        experienceData.company_website
      ]
    });

    return this.getWorkExperienceById(result.lastInsertRowid as number);
  }

  async getAllWorkExperience(): Promise<WorkExperience[]> {
    const result = await this.db.execute(`
      SELECT * FROM work_experience
      ORDER BY current_position DESC, end_date DESC, start_date DESC
    `);

    return result.rows.map((row: any) => ({
      ...row,
      key_achievements: JSON.parse(row.key_achievements || '[]'),
      technologies_used: JSON.parse(row.technologies_used || '[]'),
      references: JSON.parse(row.references || '[]')
    }));
  }

  // Education management
  async createEducation(educationData: Omit<Education, 'id' | 'created_at' | 'updated_at'>): Promise<Education> {
    const result = await this.db.execute({
      sql: `INSERT INTO education (
        institution, degree_type, field_of_study, start_date, end_date,
        current_status, gpa, honors, description, relevant_coursework,
        thesis_title, certificate_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        educationData.institution, educationData.degree_type, educationData.field_of_study,
        educationData.start_date, educationData.end_date, educationData.current_status,
        educationData.gpa, JSON.stringify(educationData.honors || []),
        educationData.description, JSON.stringify(educationData.relevant_coursework || []),
        educationData.thesis_title, educationData.certificate_url
      ]
    });

    return this.getEducationById(result.lastInsertRowid as number);
  }

  // Testimonials management
  async createTestimonial(testimonialData: Omit<Testimonial, 'id' | 'created_at'>): Promise<Testimonial> {
    const result = await this.db.execute({
      sql: `INSERT INTO testimonials (
        client_name, client_position, client_company, client_email,
        project_id, testimonial_text, rating, date_given,
        permission_to_display, featured, testimonial_type, work_relationship
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        testimonialData.client_name, testimonialData.client_position, testimonialData.client_company,
        testimonialData.client_email, testimonialData.project_id, testimonialData.testimonial_text,
        testimonialData.rating, testimonialData.date_given, testimonialData.permission_to_display,
        testimonialData.featured, testimonialData.testimonial_type, testimonialData.work_relationship
      ]
    });

    return this.getTestimonialById(result.lastInsertRowid as number);
  }

  async getFeaturedTestimonials(limit = 5): Promise<Testimonial[]> {
    const result = await this.db.execute({
      sql: `SELECT t.*, p.title as project_title, p.slug as project_slug
            FROM testimonials t
            LEFT JOIN portfolio_projects p ON t.project_id = p.id
            WHERE t.permission_to_display = TRUE AND t.featured = TRUE
            ORDER BY t.rating DESC, t.date_given DESC
            LIMIT ?`,
      args: [limit]
    });

    return result.rows as any[];
  }

  // Portfolio analytics
  async getPortfolioStatistics(): Promise<{
    totalProjects: number;
    completedProjects: number;
    totalSkills: number;
    yearsExperience: number;
    averageProjectRating: number;
    totalTestimonials: number;
    topSkills: string[];
    recentProjects: Project[];
  }> {
    const [statsResult, skillsResult, projectsResult] = await Promise.all([
      this.db.execute(`
        SELECT 
          COUNT(*) as total_projects,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_projects
        FROM portfolio_projects
      `),
      this.db.execute(`
        SELECT name FROM skills 
        WHERE priority_level = 'high' 
        ORDER BY proficiency_level DESC, years_experience DESC 
        LIMIT 8
      `),
      this.db.execute(`
        SELECT * FROM portfolio_projects 
        WHERE status = 'completed'
        ORDER BY end_date DESC 
        LIMIT 6
      `)
    ]);

    const stats = statsResult.rows[0] as any;
    const topSkills = skillsResult.rows.map((row: any) => row.name);
    const recentProjects = projectsResult.rows.map((row: any) => ({
      ...row,
      gallery_images: JSON.parse(row.gallery_images || '[]'),
      tech_stack: JSON.parse(row.tech_stack || '[]')
    }));

    // Calculate years of experience from work experience
    const experienceResult = await this.db.execute(`
      SELECT MIN(start_date) as first_job FROM work_experience
    `);
    
    const firstJob = (experienceResult.rows[0] as any)?.first_job;
    const yearsExperience = firstJob ? 
      Math.floor((new Date().getTime() - new Date(firstJob).getTime()) / (1000 * 60 * 60 * 24 * 365)) : 0;

    // Get average testimonial rating
    const ratingResult = await this.db.execute(`
      SELECT AVG(rating) as avg_rating, COUNT(*) as total_testimonials
      FROM testimonials 
      WHERE permission_to_display = TRUE
    `);
    
    const ratings = ratingResult.rows[0] as any;

    return {
      totalProjects: stats.total_projects || 0,
      completedProjects: stats.completed_projects || 0,
      totalSkills: await this.getSkillsCount(),
      yearsExperience,
      averageProjectRating: Math.round((ratings.avg_rating || 0) * 10) / 10,
      totalTestimonials: ratings.total_testimonials || 0,
      topSkills,
      recentProjects
    };
  }

  private async getSkillsCount(): Promise<number> {
    const result = await this.db.execute('SELECT COUNT(*) as count FROM skills');
    return (result.rows[0] as any).count || 0;
  }
}
```

### Step 2: Portfolio Showcase Component (85 minutes)

**Portfolio Grid Component** (src/components/portfolio/PortfolioGrid.svelte):
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Project } from '../../lib/db/types';
  import ProjectCard from './ProjectCard.svelte';
  import FilterControls from './FilterControls.svelte';
  
  export let initialProjects: Project[] = [];
  export let showFilters = true;
  export let limit = 12;
  export let layout: 'grid' | 'masonry' | 'list' = 'grid';

  let projects = initialProjects;
  let loading = false;
  let currentPage = 1;
  let hasNextPage = true;
  let totalProjects = 0;

  // Filter states
  let selectedCategory = '';
  let selectedTechnology = '';
  let selectedStatus = '';
  let sortBy = 'latest';
  let searchQuery = '';

  // Available filter options
  let categories: string[] = [];
  let technologies: string[] = [];
  let statuses = ['all', 'completed', 'in-progress', 'planning'];

  onMount(async () => {
    await loadFilterOptions();
    await loadProjects(true);
  });

  async function loadFilterOptions() {
    try {
      const response = await fetch('/api/portfolio/filter-options');
      const data = await response.json();
      
      if (data.success) {
        categories = data.data.categories;
        technologies = data.data.technologies;
      }
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  }

  async function loadProjects(reset = false) {
    if (loading) return;
    
    loading = true;
    const page = reset ? 1 : currentPage;

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(selectedCategory && { category: selectedCategory }),
        ...(selectedTechnology && { technology: selectedTechnology }),
        ...(selectedStatus && selectedStatus !== 'all' && { status: selectedStatus }),
        ...(searchQuery && { search: searchQuery }),
        ...(sortBy && { sort: sortBy })
      });

      const response = await fetch(`/api/portfolio?${params}`);
      const data = await response.json();

      if (data.success) {
        if (reset) {
          projects = data.data.data;
          currentPage = 1;
        } else {
          projects = [...projects, ...data.data.data];
        }
        
        hasNextPage = data.data.hasNextPage;
        totalProjects = data.data.total;
        currentPage = data.data.currentPage;
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      loading = false;
    }
  }

  async function handleFilterChange() {
    currentPage = 1;
    await loadProjects(true);
  }

  async function loadMore() {
    if (hasNextPage && !loading) {
      currentPage++;
      await loadProjects();
    }
  }

  function clearFilters() {
    selectedCategory = '';
    selectedTechnology = '';
    selectedStatus = '';
    searchQuery = '';
    sortBy = 'latest';
    handleFilterChange();
  }

  // Reactive updates for filters
  $: if (selectedCategory !== undefined || selectedTechnology !== undefined || 
         selectedStatus !== undefined || sortBy !== undefined || searchQuery !== undefined) {
    handleFilterChange();
  }
</script>

<div class="portfolio-container">
  {#if showFilters}
    <FilterControls
      bind:selectedCategory
      bind:selectedTechnology
      bind:selectedStatus
      bind:sortBy
      bind:searchQuery
      {categories}
      {technologies}
      {statuses}
      {totalProjects}
      on:clear={clearFilters}
    />
  {/if}

  <div class="portfolio-grid" class:masonry={layout === 'masonry'} class:list={layout === 'list'}>
    {#each projects as project (project.id)}
      <ProjectCard {project} {layout} />
    {/each}
  </div>

  {#if loading}
    <div class="loading-container">
      <div class="loading-grid">
        {#each Array(6) as _}
          <div class="loading-card">
            <div class="loading-image"></div>
            <div class="loading-content">
              <div class="loading-title"></div>
              <div class="loading-text"></div>
              <div class="loading-text short"></div>
              <div class="loading-tags">
                <div class="loading-tag"></div>
                <div class="loading-tag"></div>
                <div class="loading-tag"></div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if hasNextPage && !loading}
    <div class="load-more-container">
      <button 
        on:click={loadMore}
        class="load-more-btn"
      >
        Load More Projects
      </button>
    </div>
  {/if}

  {#if projects.length === 0 && !loading}
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="9" cy="9" r="2"/>
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
        </svg>
      </div>
      <h3>No projects found</h3>
      <p>Try adjusting your filters or search terms.</p>
      <button on:click={clearFilters} class="clear-filters-btn">
        Clear All Filters
      </button>
    </div>
  {/if}
</div>

<style>
  .portfolio-container {
    @apply space-y-8;
  }

  .portfolio-grid {
    @apply grid gap-6;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  }

  .portfolio-grid.masonry {
    @apply columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6;
    column-fill: balance;
  }

  .portfolio-grid.list {
    @apply grid-cols-1 gap-4;
  }

  .loading-container {
    @apply mt-8;
  }

  .loading-grid {
    @apply grid gap-6;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  }

  .loading-card {
    @apply bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-pulse;
  }

  .loading-image {
    @apply bg-gray-300 dark:bg-gray-600 rounded-lg h-48 mb-4;
  }

  .loading-content .loading-title {
    @apply bg-gray-300 dark:bg-gray-600 rounded h-6 mb-3;
  }

  .loading-content .loading-text {
    @apply bg-gray-300 dark:bg-gray-600 rounded h-4 mb-2;
  }

  .loading-content .loading-text.short {
    @apply w-3/4;
  }

  .loading-tags {
    @apply flex space-x-2 mt-4;
  }

  .loading-tag {
    @apply bg-gray-300 dark:bg-gray-600 rounded-full h-6 w-16;
  }

  .load-more-container {
    @apply text-center mt-12;
  }

  .load-more-btn {
    @apply bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
  }

  .empty-state {
    @apply text-center py-16;
  }

  .empty-icon {
    @apply text-gray-400 dark:text-gray-500 mb-4 flex justify-center;
  }

  .empty-state h3 {
    @apply text-xl font-semibold text-gray-900 dark:text-white mb-2;
  }

  .empty-state p {
    @apply text-gray-600 dark:text-gray-400 mb-6;
  }

  .clear-filters-btn {
    @apply bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-6 py-2 rounded-lg font-medium transition-colors;
  }
</style>
```

**Individual Project Card** (src/components/portfolio/ProjectCard.svelte):
```svelte
<script lang="ts">
  import type { Project } from '../../lib/db/types';
  import { formatDate } from '../../lib/utils/date';
  
  export let project: Project;
  export let layout: 'grid' | 'masonry' | 'list' = 'grid';

  $: projectDuration = project.start_date && project.end_date
    ? calculateDuration(project.start_date, project.end_date)
    : null;

  function calculateDuration(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                   (endDate.getMonth() - startDate.getMonth());
    
    if (months < 1) return '< 1 month';
    if (months === 1) return '1 month';
    if (months < 12) return `${months} months`;
    
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    
    if (remainingMonths === 0) return `${years} year${years > 1 ? 's' : ''}`;
    return `${years}y ${remainingMonths}m`;
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'in-progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'planning': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  }
</script>

<article 
  class="project-card" 
  class:featured={project.featured}
  class:list-layout={layout === 'list'}
>
  <div class="card-inner">
    {#if project.featured_image}
      <div class="image-container">
        <img 
          src={project.featured_image} 
          alt={project.title}
          loading="lazy"
          class="project-image"
        />
        <div class="image-overlay">
          <div class="overlay-content">
            <a href={`/portfolio/${project.slug}`} class="view-project-btn">
              View Project
            </a>
            {#if project.demo_video_url}
              <button class="play-btn" title="Play Demo Video">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="m9.74 12 8.06-4.67c.28-.16.28-.56 0-.72L9.74 2c-.28-.16-.64-.04-.64.36v9.28c0 .4.36.52.64.36z"/>
                </svg>
              </button>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <div class="card-content">
      <div class="card-header">
        <div class="title-row">
          <h3 class="project-title">
            <a href={`/portfolio/${project.slug}`}>
              {project.title}
            </a>
          </h3>
          {#if project.featured}
            <span class="featured-badge">Featured</span>
          {/if}
        </div>
        
        <div class="meta-info">
          <span class="status-badge {getStatusColor(project.status)}">
            {project.status.replace('-', ' ')}
          </span>
          {#if project.project_type}
            <span class="type-badge">
              {project.project_type}
            </span>
          {/if}
          {#if projectDuration}
            <span class="duration">
              {projectDuration}
            </span>
          {/if}
        </div>
      </div>

      <p class="project-description">
        {project.short_description}
      </p>

      {#if project.tech_stack && project.tech_stack.length > 0}
        <div class="tech-stack">
          {#each project.tech_stack.slice(0, 6) as tech}
            <span class="tech-tag">{tech}</span>
          {/each}
          {#if project.tech_stack.length > 6}
            <span class="tech-more">+{project.tech_stack.length - 6}</span>
          {/if}
        </div>
      {/if}

      <div class="card-footer">
        <div class="project-links">
          {#if project.project_url}
            <a 
              href={project.project_url} 
              target="_blank" 
              rel="noopener noreferrer"
              class="project-link"
              title="Live Project"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15,3 21,3 21,9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Live
            </a>
          {/if}
          
          {#if project.github_url}
            <a 
              href={project.github_url} 
              target="_blank" 
              rel="noopener noreferrer"
              class="project-link"
              title="Source Code"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Code
            </a>
          {/if}
        </div>

        <div class="engagement-stats">
          {#if project.view_count}
            <span class="stat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              {project.view_count}
            </span>
          {/if}
          
          {#if project.testimonial_count}
            <span class="stat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {project.testimonial_count}
            </span>
          {/if}
        </div>
      </div>
    </div>
  </div>
</article>

<style>
  .project-card {
    @apply bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1;
  }

  .project-card.featured {
    @apply ring-2 ring-blue-500 dark:ring-blue-400;
  }

  .project-card.list-layout {
    @apply flex items-center p-6;
  }

  .project-card.list-layout .image-container {
    @apply w-48 h-32 flex-shrink-0 mr-6;
  }

  .card-inner {
    @apply h-full flex flex-col;
  }

  .list-layout .card-inner {
    @apply flex-row items-center flex-1;
  }

  .image-container {
    @apply relative aspect-video overflow-hidden;
  }

  .project-image {
    @apply w-full h-full object-cover transition-transform duration-300 hover:scale-105;
  }

  .image-overlay {
    @apply absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center opacity-0 hover:opacity-100;
  }

  .overlay-content {
    @apply flex space-x-3;
  }

  .view-project-btn {
    @apply bg-white text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors;
  }

  .play-btn {
    @apply bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors;
  }

  .card-content {
    @apply p-6 flex-1 flex flex-col;
  }

  .list-layout .card-content {
    @apply p-0 flex-1;
  }

  .card-header {
    @apply mb-4;
  }

  .title-row {
    @apply flex items-start justify-between mb-2;
  }

  .project-title {
    @apply text-xl font-bold text-gray-900 dark:text-white;
  }

  .project-title a {
    @apply hover:text-blue-600 dark:hover:text-blue-400 transition-colors;
  }

  .featured-badge {
    @apply bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ml-2;
  }

  .meta-info {
    @apply flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400;
  }

  .status-badge {
    @apply px-2 py-1 text-xs font-medium rounded-full capitalize;
  }

  .type-badge {
    @apply bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 px-2 py-1 text-xs rounded-full;
  }

  .duration {
    @apply text-xs;
  }

  .project-description {
    @apply text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-4 flex-1;
  }

  .tech-stack {
    @apply flex flex-wrap gap-2 mb-4;
  }

  .tech-tag {
    @apply bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs px-2 py-1 rounded-full font-medium;
  }

  .tech-more {
    @apply bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 text-xs px-2 py-1 rounded-full font-medium;
  }

  .card-footer {
    @apply flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700;
  }

  .project-links {
    @apply flex space-x-3;
  }

  .project-link {
    @apply inline-flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors;
  }

  .engagement-stats {
    @apply flex items-center space-x-3;
  }

  .stat {
    @apply inline-flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-500;
  }
</style>
```

### Step 3: Professional Skills Visualization (45 minutes)

**Skills Dashboard Component** (src/components/skills/SkillsDashboard.svelte):
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Skill } from '../../lib/db/types';
  import SkillCategory from './SkillCategory.svelte';
  import SkillChart from './SkillChart.svelte';

  export let skills: Skill[] = [];
  
  let skillsByCategory: { [key: string]: Skill[] } = {};
  let selectedCategory = 'all';
  let viewMode: 'grid' | 'chart' | 'timeline' = 'grid';
  
  $: {
    skillsByCategory = skills.reduce((acc, skill) => {
      if (!acc[skill.category]) {
        acc[skill.category] = [];
      }
      acc[skill.category].push(skill);
      return acc;
    }, {} as { [key: string]: Skill[] });
  }
  
  $: categories = Object.keys(skillsByCategory).sort();
  $: filteredSkills = selectedCategory === 'all' 
    ? skills 
    : skillsByCategory[selectedCategory] || [];

  function getProficiencyLabel(level: number): string {
    const labels = ['', 'Beginner', 'Intermediate', 'Advanced', 'Expert', 'Master'];
    return labels[level] || 'Unknown';
  }

  function getCategoryIcon(category: string): string {
    const icons = {
      'programming': '💻',
      'framework': '🏗️',
      'database': '🗃️',
      'tool': '🔧',
      'soft-skill': '🧠',
      'language': '🌍'
    };
    return icons[category] || '📌';
  }
</script>

<div class="skills-dashboard">
  <div class="dashboard-header">
    <div class="header-content">
      <h2 class="section-title">Technical Skills & Expertise</h2>
      <p class="section-description">
        Comprehensive overview of my technical skills, proficiency levels, and years of experience
      </p>
    </div>
    
    <div class="dashboard-controls">
      <div class="category-filter">
        <select bind:value={selectedCategory} class="filter-select">
          <option value="all">All Categories</option>
          {#each categories as category}
            <option value={category}>
              {getCategoryIcon(category)} {category.replace('-', ' ').toUpperCase()}
            </option>
          {/each}
        </select>
      </div>
      
      <div class="view-mode-toggle">
        <button 
          class="toggle-btn"
          class:active={viewMode === 'grid'}
          on:click={() => viewMode = 'grid'}
          title="Grid View"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
        </button>
        <button 
          class="toggle-btn"
          class:active={viewMode === 'chart'}
          on:click={() => viewMode = 'chart'}
          title="Chart View"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        </button>
      </div>
    </div>
  </div>

  <div class="skills-overview">
    <div class="overview-stats">
      <div class="stat-card">
        <div class="stat-number">{skills.length}</div>
        <div class="stat-label">Total Skills</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{categories.length}</div>
        <div class="stat-label">Categories</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">
          {Math.round(skills.reduce((sum, skill) => sum + (skill.years_experience || 0), 0) / skills.length)}
        </div>
        <div class="stat-label">Avg Years</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">
          {skills.filter(skill => skill.proficiency_level >= 4).length}
        </div>
        <div class="stat-label">Expert Level</div>
      </div>
    </div>
  </div>

  <div class="skills-content">
    {#if viewMode === 'grid'}
      {#if selectedCategory === 'all'}
        {#each categories as category}
          <SkillCategory 
            {category}
            skills={skillsByCategory[category]}
            icon={getCategoryIcon(category)}
          />
        {/each}
      {:else}
        <SkillCategory 
          category={selectedCategory}
          skills={filteredSkills}
          icon={getCategoryIcon(selectedCategory)}
          expanded={true}
        />
      {/if}
    {:else if viewMode === 'chart'}
      <SkillChart skills={filteredSkills} />
    {/if}
  </div>

  <!-- Skills Legend -->
  <div class="skills-legend">
    <h3 class="legend-title">Proficiency Levels</h3>
    <div class="legend-items">
      {#each [1, 2, 3, 4, 5] as level}
        <div class="legend-item">
          <div class="proficiency-indicator level-{level}"></div>
          <span class="legend-label">{getProficiencyLabel(level)}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .skills-dashboard {
    @apply space-y-8;
  }

  .dashboard-header {
    @apply flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-gray-200 dark:border-gray-700;
  }

  .header-content h2 {
    @apply text-2xl font-bold text-gray-900 dark:text-white mb-2;
  }

  .section-description {
    @apply text-gray-600 dark:text-gray-400;
  }

  .dashboard-controls {
    @apply flex items-center space-x-4;
  }

  .filter-select {
    @apply bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent;
  }

  .view-mode-toggle {
    @apply flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1;
  }

  .toggle-btn {
    @apply p-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors;
  }

  .toggle-btn.active {
    @apply bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm;
  }

  .skills-overview {
    @apply bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-6;
  }

  .overview-stats {
    @apply grid grid-cols-2 sm:grid-cols-4 gap-4;
  }

  .stat-card {
    @apply text-center;
  }

  .stat-number {
    @apply text-3xl font-bold text-blue-600 dark:text-blue-400;
  }

  .stat-label {
    @apply text-sm text-gray-600 dark:text-gray-400 mt-1;
  }

  .skills-content {
    @apply space-y-8;
  }

  .skills-legend {
    @apply bg-gray-50 dark:bg-gray-800 rounded-lg p-6;
  }

  .legend-title {
    @apply text-lg font-semibold text-gray-900 dark:text-white mb-4;
  }

  .legend-items {
    @apply grid grid-cols-2 sm:grid-cols-5 gap-4;
  }

  .legend-item {
    @apply flex items-center space-x-2;
  }

  .proficiency-indicator {
    @apply w-4 h-4 rounded-full;
  }

  .proficiency-indicator.level-1 { @apply bg-red-400; }
  .proficiency-indicator.level-2 { @apply bg-orange-400; }
  .proficiency-indicator.level-3 { @apply bg-yellow-400; }
  .proficiency-indicator.level-4 { @apply bg-green-400; }
  .proficiency-indicator.level-5 { @apply bg-purple-400; }

  .legend-label {
    @apply text-sm text-gray-700 dark:text-gray-300;
  }
</style>
```

## Testing & Validation

### Final Checklist
- [ ] Portfolio projects display correctly with all metadata and images
- [ ] Project filtering and search functionality works smoothly
- [ ] Skills dashboard shows accurate proficiency levels and categories
- [ ] Individual project pages load with complete case study information
- [ ] Work experience timeline displays chronologically and accurately
- [ ] Education and certification data is properly formatted
- [ ] Testimonials display with proper attribution and ratings
- [ ] Portfolio analytics track views and engagement correctly
- [ ] API endpoints handle all portfolio operations without errors
- [ ] Responsive design works perfectly across all device sizes

## Success Criteria
✅ Comprehensive portfolio system showcases all projects effectively  
✅ Professional credentials and skills are accurately represented  
✅ Interactive components enhance user engagement and understanding  
✅ Case study system provides detailed project documentation  
✅ All portfolio data is properly structured and queryable  
✅ Performance remains optimal with media-rich content  
✅ SEO optimization ensures project discoverability  
✅ System integrates seamlessly with existing blog and admin panels  

## Next Session
Plan 7 will focus on performance optimization, testing implementation, and ensuring the entire system runs efficiently with comprehensive test coverage.