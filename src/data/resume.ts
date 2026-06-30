import { z } from 'zod';

import rawResume from '../../content/resume.json';

export const resumeSkillGroups = ['core', 'tool', 'research'] as const;

const resumeSkillSchema = z.object({
  name: z.string().min(1),
  highlight: z.boolean().optional(),
  group: z.enum(resumeSkillGroups),
});

const resumeProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

const resumeExperienceSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  period: z.string().min(1),
  description: z.string().min(1),
  projects: z.array(resumeProjectSchema),
});

const resumeEducationSchema = z.object({
  school: z.string().min(1),
  degree: z.string().min(1),
  detail: z.string().min(1),
  period: z.string().min(1),
});

export const resumeDataSchema = z.object({
  education: z.array(resumeEducationSchema),
  experience: z.array(resumeExperienceSchema),
  skills: z.array(resumeSkillSchema),
});

export type ResumeData = z.infer<typeof resumeDataSchema>;
export type ResumeSkillGroup = (typeof resumeSkillGroups)[number];
export type ResumeSkill = ResumeData['skills'][number];

export const resumeData = resumeDataSchema.parse(rawResume);
