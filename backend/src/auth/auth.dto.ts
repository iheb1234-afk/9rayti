import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class TutorSubjectDto {
  @IsString()
  code!: string;

  @IsNumber()
  @Min(5)
  @Max(100)
  pricePerHourDt!: number;
}

export class RegisterDto {
  @IsIn(['etudiant', 'tuteur'])
  role!: 'etudiant' | 'tuteur';

  @IsString()
  @Length(2, 40)
  firstName!: string;

  @IsString()
  @Length(2, 40)
  lastName!: string;

  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit faire au moins 8 caractères' })
  @Matches(/\d/, { message: 'Le mot de passe doit contenir au moins un chiffre' })
  password!: string;

  @IsString()
  @Length(2, 60)
  school!: string;

  @IsString()
  @Length(1, 30)
  year!: string;

  @IsOptional()
  @IsIn(['fr', 'ar', 'en'])
  lang?: 'fr' | 'ar' | 'en';

  /** Tuteur uniquement : moyenne de l'année précédente (vérifiée par l'admin sur le relevé). */
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(20)
  declaredAverage?: number;

  @IsOptional()
  @IsString()
  @Length(0, 600)
  bio?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => TutorSubjectDto)
  subjects?: TutorSubjectDto[];
}

export class LoginDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email!: string;

  @IsString()
  password!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  lastName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 60)
  school?: string;

  @IsOptional()
  @IsString()
  @Length(0, 30)
  year?: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @Length(8, 72, { message: 'Le nouveau mot de passe doit faire au moins 8 caractères' })
  @Matches(/\d/, { message: 'Le nouveau mot de passe doit contenir au moins un chiffre' })
  newPassword!: string;
}

export class AvatarDto {
  /** Image redimensionnée dans le navigateur, en data URL (PNG, JPEG ou WebP, 300 ko au plus). */
  @IsString()
  @Matches(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, { message: 'Image invalide (PNG, JPEG ou WebP)' })
  @Length(30, 420_000, { message: 'Image trop lourde (300 ko au plus)' })
  dataUrl!: string;
}
