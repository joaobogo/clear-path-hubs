DO $mig$
DECLARE
  v_org uuid := 'eecccfe4-67dd-4a20-8606-76e3441a27c1';
  v_creator uuid := '8af09529-81c2-4b93-9d5e-b4387aa0f2b2';
  v_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM positions
    WHERE organization_id = v_org
      AND lower(btrim(title)) = 'social media & design specialist'
      AND status <> 'archived'
  ) THEN
    RAISE NOTICE 'position already exists, skipping';
    RETURN;
  END IF;

  INSERT INTO positions (
    organization_id, created_by, owner_user_id, title, department, location, work_model,
    employment_type, seniority, openings, status, visibility, compensation_collected,
    compensation_visibility, description, requirements, preferred_requirements, dealbreakers,
    compensation, intake_context, work_authorization
  ) VALUES (
    v_org, v_creator, v_creator,
    'Social Media & Design Specialist', 'Marketing', 'Curitiba, PR', 'remote',
    'full_time', 'Junior to Mid-Level', 1, 'draft', 'private', true, 'public',
$md$Flow Group Ventures is hiring a full-time Social Media & Design Specialist to support the social media presence of the companies and personal brands within the FGV ecosystem.

The person hired will manage content for approximately five LinkedIn company pages and three personal LinkedIn profiles. The role combines content planning, copywriting, graphic design, brand management, and fast execution.

We are looking for someone creative, organized, proactive, and comfortable working in a fast-paced environment with short deadlines and changing priorities. The ideal candidate knows how to use AI tools to improve productivity while still producing original, professional, and human-quality content.

CONTRACT AND COMPENSATION
- Full-time position
- PJ contract (Pessoa Juridica)
- R$2,500 to R$5,000 per month
- Final compensation will depend on the candidate's experience, skills, and portfolio
- Start date: as soon as possible
- Application language: English

MAIN RESPONSIBILITIES
- Develop monthly and weekly social media content calendars.
- Plan content for approximately five LinkedIn company pages.
- Plan content for approximately three personal LinkedIn profiles.
- Write, edit, and prepare professional LinkedIn posts.
- Adapt messaging to different companies, industries, audiences, and personal brands.
- Create graphics, carousels, banners, and other social media designs.
- Maintain consistent visual identity, messaging, and tone across every account.
- Transform company updates, services, results, ideas, and industry information into engaging content.
- Repurpose existing materials into multiple social media formats.
- Support the marketing team with small design requests.
- Occasionally create or adapt visual assets for paid social media advertisements.
- Organize content files, drafts, approvals, and publishing schedules.
- Work closely with leadership and other team members.
- Handle quick turnarounds and close deadlines.
- Review content carefully before publication.
- Monitor engagement and identify opportunities to improve brand awareness and content performance.
- Use AI tools for research, ideation, writing support, design support, content repurposing, and workflow acceleration.
- Ensure that final content does not look generic, automated, or obviously AI-generated.

CANDIDATE PROFILE
The ideal candidate is someone who can take a rough idea, understand the intended audience, write the content, create the visual asset, organize it in the content calendar, make revisions quickly, and deliver the final material on time. This person should combine creativity with execution, and be comfortable managing several brands without making every account sound or look the same.

WHAT TO SUBMIT WITH YOUR APPLICATION
Full name; email address; phone number; city and country; resume or CV; portfolio link or uploaded portfolio; LinkedIn profile; relevant social media management experience; relevant graphic design experience; examples of LinkedIn pages, personal profiles or social accounts you have managed; design tools you use; AI tools you use; monthly compensation expectation; earliest available start date; and confirmation that you can work full-time, under a PJ contract, with fast deadlines, and are willing to complete a short practical assessment.$md$,
$j$[
  {"kind":"must_have","label":"Professional social media management or content creation experience"},
  {"kind":"must_have","label":"Graphic design experience"},
  {"kind":"must_have","label":"Building and maintaining content calendars"},
  {"kind":"must_have","label":"LinkedIn content and company-page management"},
  {"kind":"must_have","label":"Strong English writing and editing"},
  {"kind":"must_have","label":"Managing multiple brands and accounts simultaneously"},
  {"kind":"must_have","label":"Adjusting messaging for different audiences"},
  {"kind":"must_have","label":"Strong attention to detail"},
  {"kind":"must_have","label":"Strong organization and time management"},
  {"kind":"must_have","label":"Works independently and meets short deadlines"},
  {"kind":"must_have","label":"Comfortable in a fast-paced environment"},
  {"kind":"must_have","label":"Comfortable receiving feedback and revising quickly"},
  {"kind":"must_have","label":"Willing to use AI tools in the daily workflow"},
  {"kind":"must_have","label":"Portfolio of relevant social media or design work"}
]$j$::jsonb,
$j$[
  {"label":"Managing LinkedIn company pages and personal executive profiles"},
  {"label":"Creating LinkedIn carousels"},
  {"label":"Working with multiple brands under one business group"},
  {"label":"Familiarity with B2B marketing"},
  {"label":"Agency, startup or technology company experience"},
  {"label":"Designing assets for paid social campaigns"},
  {"label":"Social media analytics and performance reporting"},
  {"label":"Canva, Adobe Creative Suite, Figma or similar"},
  {"label":"ChatGPT or other AI writing, research or design tools"},
  {"label":"Project-management and content-approval systems"}
]$j$::jsonb,
$j$[
  {"label":"Cannot work full-time"},
  {"label":"Cannot work under a PJ contract"},
  {"label":"No portfolio of social media or design work"},
  {"label":"No graphic design experience"},
  {"label":"Insufficient professional English writing"}
]$j$::jsonb,
$j${"currency":"BRL","budget_min":"2500","budget_max":"5000","period":"month","summary":"R$2,500 to R$5,000 per month (PJ contract). Final compensation will depend on the candidate's experience, skills, and portfolio.","contract_type":"PJ - Pessoa Juridica","urgency":"As soon as possible"}$j$::jsonb,
$j${"responsibilities":"Content calendars (monthly and weekly); content planning for ~5 LinkedIn company pages and ~3 personal LinkedIn profiles; writing and editing professional LinkedIn posts; graphics, carousels and banners; maintaining visual identity and tone across accounts; repurposing materials; small design requests; occasional paid-social assets; organising files, drafts, approvals and schedules; monitoring engagement; using AI tools without producing generic output.","experience":"Junior to Mid-Level, depending on experience","tools_platforms":["Canva","Adobe Creative Suite","Figma","LinkedIn","ChatGPT"],"target_start_date":"As soon as possible","time_to_hire":"As soon as possible","interview_process":"Application review, interview, and a short practical assessment covering LinkedIn copy and design.","application_language":"English","contract_type":"PJ - Pessoa Juridica","primary_function":"Social Media, Content Creation and Graphic Design","hiring_objective":"Increase brand awareness and maintain a consistent, professional and engaging presence across the FGV business ecosystem.","application_requirements":["Full name","Email address","Phone number","City and country","Resume or CV","Portfolio link or upload","LinkedIn profile","Relevant social media management experience","Relevant graphic design experience","Examples of LinkedIn pages/profiles/accounts managed","Design tools used","AI tools used","Monthly compensation expectation","Earliest available start date","Confirm full-time availability","Confirm PJ contract","Confirm comfort with fast deadlines","Confirm willingness to complete a practical assessment"],"tags":["Social Media Management","LinkedIn Marketing","Content Creation","Content Strategy","Content Calendar","Copywriting","Graphic Design","Canva","Adobe Creative Suite","Figma","B2B Marketing","Brand Management","AI Tools","Generative AI","Social Media Design","Marketing","English","Project Management","Social Media Analytics","Paid Social Design"],"additional_context":"Approximately five LinkedIn company pages and three personal LinkedIn profiles across the FGV ecosystem. Location and work arrangement carried over from the previous Flow Group Ventures record (Curitiba, PR - remote) and pending owner confirmation."}$j$::jsonb,
$j${"countries":["Brazil"],"target_titles":["Social Media Specialist","Social Media Manager","Content and Design Specialist","Graphic Designer","Social Media Designer"]}$j$::jsonb
  ) RETURNING id INTO v_id;

  INSERT INTO position_locations (position_id, organization_id, country_code, country, region, city, work_model, is_primary, headcount, display_order)
  VALUES (v_id, v_org, 'BR', 'Brazil', 'PR', 'Curitiba', 'remote', true, 1, 0);

  INSERT INTO screening_questions (position_id, question, answer_type, required, dealbreaker, display_order) VALUES
  (v_id,'How many years of professional social media experience do you have?','number',true,false,1),
  (v_id,'How many years of graphic design experience do you have?','number',true,false,2),
  (v_id,'Have you previously managed LinkedIn company pages?','boolean',true,false,3),
  (v_id,'Have you created content for personal or executive LinkedIn profiles?','boolean',true,false,4),
  (v_id,'How many brands or social media accounts have you managed simultaneously?','number',true,false,5),
  (v_id,'Which design tools do you use professionally?','text',true,false,6),
  (v_id,'Which AI tools do you currently use in your content or design workflow?','text',true,false,7),
  (v_id,'Please provide a link to your portfolio.','text',true,true,8),
  (v_id,'Please provide examples of LinkedIn content or pages you have managed.','text',true,false,9),
  (v_id,'Are you available to work full-time?','boolean',true,true,10),
  (v_id,'Are you able to work under a PJ contract?','boolean',true,true,11),
  (v_id,'What is your expected monthly compensation in Brazilian reais?','text',true,false,12),
  (v_id,'What is your earliest possible start date?','text',true,false,13),
  (v_id,'Are you comfortable working in a fast-paced environment with close deadlines?','boolean',true,false,14),
  (v_id,'Are you willing to complete a short practical assessment involving LinkedIn copy and design?','boolean',true,false,15);

  UPDATE positions SET status = 'submitted', submitted_at = now() WHERE id = v_id;
  UPDATE positions SET status = 'approved', approved_at = now() WHERE id = v_id;
  UPDATE positions SET status = 'active' WHERE id = v_id;
  UPDATE positions SET visibility = 'public', published_at = now() WHERE id = v_id;
END
$mig$;