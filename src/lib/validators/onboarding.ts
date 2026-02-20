
import { z } from 'zod'

// ==================== REAL PROFILE VALIDATORS ====================

const NameSchema = z.string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters long" })
    .max(50, { message: "Name must be 50 characters or less" })
    .regex(/^[a-zA-Z\s\-']+$/, { message: "Name can only contain letters, spaces, hyphens and apostrophes" })

const DobSchema = z.string()
    .refine((dob) => !isNaN(new Date(dob).getTime()), { message: "Please enter a valid date" })
    .refine((dob) => {
        const birthDate = new Date(dob)
        const today = new Date()
        let age = today.getFullYear() - birthDate.getFullYear()
        const m = today.getMonth() - birthDate.getMonth()
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--
        }
        return age >= 18
    }, { message: "You must be at least 18 years old to join Unfold" })

const HeightSchema = z.coerce.number() // coerce handles string "175" -> number 175
    .min(50, { message: "Height must be at least 50cm" })
    .max(300, { message: "Height seems unrealistic (max 300cm)" })

const LocationSchema = z.string()
    .trim()
    .min(2, { message: "Must be at least 2 characters" })
    .max(100, { message: "Must be 100 characters or less" })

// ==================== SHADOW PROFILE VALIDATORS ====================

const ShadowNameSchema = z.string()
    .trim()
    .min(3, { message: "Shadow name must be at least 3 characters" })
    .max(20, { message: "Shadow name must be 20 characters or less" })

const BioSchema = z.string()
    .trim()
    .min(10, { message: "Bio must be at least 10 characters long" })
    .max(500, { message: "Bio must be 500 characters or less" })

// ==================== FULL OBJECT SCHEMAS ====================

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'] as const

// ...

export const OnboardingStep1Schema = z.object({
    name: NameSchema,
    dob: DobSchema,
    height_cm: HeightSchema,
    gender: z.enum(GENDERS),
    location_city: LocationSchema,
    location_country: LocationSchema,
})

export const OnboardingStep4Schema = z.object({
    shadow_name: ShadowNameSchema,
    bio: BioSchema,
    avatar_id: z.string().min(1, { message: "Please choose an avatar" }),
    social_energy: z.string().min(1, { message: "Please choose your social energy level" }),
    sound_of_week_url: z.string().url({ message: "Please provide a valid music URL" }),
})

// Export individual schemas for re-use in Profile Edit
export { NameSchema, DobSchema, HeightSchema, LocationSchema, BioSchema, ShadowNameSchema }
