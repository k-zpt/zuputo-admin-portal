import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'POST');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'PATCH');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path, 'DELETE');
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  try {
    // Path segments come from /api/[...path], so if client calls /api/api/v1/countries,
    // pathSegments will be ['api', 'v1', 'countries']
    // We need to forward the full path including 'api' to the backend
    const path = `/${pathSegments.join('/')}`;
    const url = new URL(path, API_BASE_URL);
    
    // Copy query parameters
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });

    // Get request body if present
    let body: string | FormData | undefined;
    const contentType = request.headers.get('content-type') || '';
    const isMultipart = contentType.includes('multipart/form-data');
    
    if (method !== 'GET' && method !== 'DELETE') {
      try {
        if (isMultipart) {
          // For file uploads, get FormData
          body = await request.formData();
        } else {
          // For JSON, get text
          body = await request.text();
        }
      } catch {
        // No body
      }
    }

    // Forward headers (excluding host, connection, content-length, and content-type for multipart)
    // For multipart/form-data, let fetch() set the Content-Type header automatically with the correct boundary
    const headers: HeadersInit = {};
    request.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (
        !['host', 'connection'].includes(lowerKey) &&
        !(isMultipart && (lowerKey === 'content-length' || lowerKey === 'content-type'))
      ) {
        headers[key] = value;
      }
    });

    // Make request to backend API
    const response = await fetch(url.toString(), {
      method,
      headers,
      body,
    });

    // Get response data
    const data = await response.text();
    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch {
      jsonData = data;
    }

    // Return response with proper status and headers
    return NextResponse.json(jsonData, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { 
        code: '99',
        msg: error instanceof Error ? error.message : 'Proxy request failed',
        data: null 
      },
      { status: 500 }
    );
  }
}

