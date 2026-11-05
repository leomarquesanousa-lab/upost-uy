export type ImportedArticle = {
  status:string; title:string; subtitle:string; excerpt:string; body:string;
  external_image_url:string; cover_image?:string; cover_alt:string; cover_caption:string; cover_credit:string;
  original_author:string; original_published_at:string; source_name:string; source_url:string;
  canonical_url?:string; warnings?:string[]; imported_image_count?:number;
  external_images?:{url:string;alt:string;caption:string;placeholder:string}[];
  cover_candidates?:{url:string;alt:string;caption:string;credit:string;origin:string}[];
};
