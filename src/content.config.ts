import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const tours = defineCollection({
    loader: glob({
        pattern: '**/*.md',
        base: './src/content/tours'
    }),
    schema: z.object({
        title: z.string(),
        subtitle: z.string(),
        durationHours: z.number(),
        priceJpy: z.number(),
        meetingPoint: z.string(),
        featuredImage: z.string().optional(),
        gygActivityId: z.string().optional(),
    }),
});

export const collections = { tours };