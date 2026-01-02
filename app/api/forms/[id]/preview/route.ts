import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/api/config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const backendUrl = `${API_BASE_URL}/api/v2/forms/${id}/preview`;

  try {
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        // Forward any necessary headers, e.g., Authorization
        // 'Authorization': request.headers.get('Authorization') || '',
      },
    });

    if (!response.ok) {
      // Check if response is JSON (error response) or empty (404 Not Found)
      const contentType = response.headers.get('Content-Type') || '';
      let errorData: any = {};
      
      if (contentType.includes('application/json')) {
        try {
          errorData = await response.json();
        } catch {
          // If JSON parsing fails, use empty object
        }
      }
      
      // Preserve the original status code from backend
      const statusCode = response.status;
      
      // Check if the error message indicates file not found
      const errorMsg = errorData.msg || errorData.message || `Failed to fetch preview: ${response.statusText}`;
      const isNotFound = statusCode === 404 || 
                        errorMsg.toLowerCase().includes('not found') || 
                        errorMsg.toLowerCase().includes('file not found');
      
      return NextResponse.json(
        {
          code: '99',
          msg: isNotFound ? 'File not found' : errorMsg,
          data: null,
        },
        { status: isNotFound ? 404 : statusCode }
      );
    }

    // Get the content type from the backend response
    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    
    // Log for debugging
    console.log('Preview response:', {
      status: response.status,
      contentType,
      contentLength: response.headers.get('Content-Length'),
    });

    // Read the response body as a stream
    const body = response.body;
    
    if (!body) {
      return NextResponse.json(
        { code: '99', msg: 'No content in preview response', data: null },
        { status: 500 }
      );
    }

    // Create a new response with the backend's body and status
    const newResponse = new NextResponse(body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': contentType,
        // Force inline display
        'Content-Disposition': 'inline',
        // Allow CORS
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        // Copy other relevant headers from the backend response
        ...(response.headers.get('Cache-Control') && { 'Cache-Control': response.headers.get('Cache-Control')! }),
        ...(response.headers.get('Expires') && { 'Expires': response.headers.get('Expires')! }),
        ...(response.headers.get('Last-Modified') && { 'Last-Modified': response.headers.get('Last-Modified')! }),
      },
    });

    return newResponse;
  } catch (error) {
    console.error('Preview proxy error:', error);
    return NextResponse.json(
      {
        code: '99',
        msg: error instanceof Error ? error.message : 'Preview proxy request failed',
        data: null,
      },
      { status: 500 }
    );
  }
}

