import { NextRequest, NextResponse } from 'next/server'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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'

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      )
    }

    // Call OpenAI API
    const reply = await callOpenAI(message)

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function callOpenAI(message: string): Promise<string> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are Clairvyn, an expert AI architecture assistant specializing in floor plan design, CAD drawings, and architectural planning. You help architecture students and professionals design efficient, functional, and beautiful spaces.

Your expertise includes:
- Floor plan design and optimization
- Kitchen, bathroom, bedroom, and living room layouts
- Furniture placement and space planning
- CAD drawings and technical specifications
- Building codes and accessibility requirements
- Interior design principles
- Space efficiency and flow
- Sustainable design practices
- Universal design and accessibility
- Structural considerations and load-bearing walls
- HVAC and electrical planning
- Plumbing layouts and fixture placement
- Lighting design and natural light optimization
- Material selection and finishes
- Cost estimation and budgeting
- Project management and timelines

Always provide helpful, detailed, and professional responses. Ask clarifying questions when needed to provide better assistance. Be encouraging and supportive of the user's design goals. Use your architectural knowledge to give practical, actionable advice. When appropriate, provide specific measurements, code requirements, and technical details.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 1200,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  } catch (error) {
    console.error('OpenAI API call failed:', error)
    // Fallback to simple response if OpenAI fails
    return generateFallbackResponse(message)
  }
}

function generateFallbackResponse(message: string): string {
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return "Hello! I'm Clairvyn, your AI architecture assistant. How can I help you design your floor plan today?"
  }

  if (lowerMessage.includes('floor plan') || lowerMessage.includes('floorplan')) {
    return "Great! I can help you design floor plans. What type of space are you working with? (e.g., kitchen, living room, office, etc.)"
  }

  if (lowerMessage.includes('kitchen')) {
    return "Kitchens are my specialty! I can help you optimize your kitchen layout. What's your current kitchen size and what appliances do you need to accommodate?"
  }

  if (lowerMessage.includes('bedroom')) {
    return "Bedroom design is important for comfort and functionality. How many bedrooms do you need, and what's the approximate square footage?"
  }

  if (lowerMessage.includes('bathroom')) {
    return "Bathroom layouts require careful planning for plumbing and fixtures. Are you designing a full bathroom, half bath, or master suite bathroom?"
  }

  if (lowerMessage.includes('living room') || lowerMessage.includes('livingroom')) {
    return "Living rooms are the heart of the home! What's your vision for the space? Do you need seating for a specific number of people?"
  }

  if (lowerMessage.includes('office') || lowerMessage.includes('workspace')) {
    return "Home offices need good lighting and ergonomic design. Will this be a dedicated office space or a multi-purpose room?"
  }

  if (lowerMessage.includes('dimensions') || lowerMessage.includes('size') || lowerMessage.includes('measurements')) {
    return "I can help you with room dimensions and measurements. What specific space are you looking to measure or design?"
  }

  if (lowerMessage.includes('furniture') || lowerMessage.includes('layout')) {
    return "Furniture layout is crucial for flow and functionality. What type of room are you furnishing, and what are your main pieces?"
  }

  if (lowerMessage.includes('cad') || lowerMessage.includes('drawing')) {
    return "I can help you with CAD drawings and technical specifications. What type of drawing do you need - floor plan, elevation, or detail?"
  }

  if (lowerMessage.includes('help') || lowerMessage.includes('assist')) {
    return "I'm here to help with all your architectural design needs! I can assist with floor plans, room layouts, furniture placement, CAD drawings, and more. What would you like to work on?"
  }

  if (lowerMessage.includes('bigger') || lowerMessage.includes('smaller') || lowerMessage.includes('extend') || lowerMessage.includes('shrink')) {
    return "I can adjust the dimensions for you. Which specific element or room would you like to resize?"
  }

  if (lowerMessage.includes('add') || lowerMessage.includes('create') || lowerMessage.includes('place')) {
    return "I can add that to your design. Where would you like it placed?"
  }

  if (lowerMessage.includes('remove') || lowerMessage.includes('delete')) {
    return "I can help remove items from your plan. What needs to be taken out?"
  }

  if (lowerMessage.includes('door') || lowerMessage.includes('window') || lowerMessage.includes('wall')) {
    return "I can modify the architectural elements. Do you have specific dimensions in mind?"
  }

  return "I'm sorry, I didn't quite catch that. Could you please rephrase or check for typos? I can help with floor plans, layouts, and CAD designs."
}
