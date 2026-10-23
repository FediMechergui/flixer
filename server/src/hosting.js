export const hosted=()=>Boolean(process.env.VERCEL||process.env.NETLIFY||process.env.AWS_LAMBDA_FUNCTION_NAME);
