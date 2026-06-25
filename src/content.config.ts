import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/index.md', base: './content/projects' }),
  schema: z
    .object({
      name: z.string(),
      slug: z.string().optional(),
      tagline: z.string(),
      type: z.enum(['personal', 'internship']),
      company: z.string().optional(),
      role: z.string(),
      period: z.string(),
      tags: z.array(z.string()),
      links: z
        .object({
          github: z.string().url().optional(),
          demo: z.string().url().optional(),
          docs: z.string().url().optional(),
        })
        .optional(),
      featured: z.boolean().optional().default(false),
    })
    .refine((data) => data.type !== 'internship' || (data.company && data.company.length > 0), {
      message: 'company is required when type is internship',
      path: ['company'],
    }),
});

const refs = defineCollection({
  loader: glob({ pattern: '**/refs/*.md', base: './content/projects' }),
  schema: z.object({
    summary: z.string(),
  }),
});

export const collections = { projects, refs };
