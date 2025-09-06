import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Satellite,
  Target,
  Users,
  Trophy,
  Star,
  Calendar,
  Mail,
  MapPin,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import astro1 from "@assets/image_1755698064384.png";
import astro2 from "@assets/image_1755698803184.png";

export default function About() {
  const boardMembers = [
    { name: "Dr. Sarah Chen", position: "President", specialization: "Astrophysics" },
    { name: "Prof. Michael Roberts", position: "Vice President", specialization: "Planetary Science" },
    { name: "Dr. Priya Sharma", position: "Secretary", specialization: "Cosmology" },
    { name: "James Wilson", position: "Treasurer", specialization: "Astronomy Education" },
    { name: "Dr. Elena Rodriguez", position: "Research Director", specialization: "Exoplanets" },
    { name: "Alex Kumar", position: "Outreach Coordinator", specialization: "Public Astronomy" }
  ];

  const projects = [
    {
      title: "Sivali Sky Survey",
      description: "A comprehensive mapping project of the southern hemisphere sky using advanced telescopes.",
      status: "Active",
      participants: 45
    },
    {
      title: "Student Astronomy Program",
      description: "Educational initiative bringing astronomy to high schools across the region.",
      status: "Ongoing",
      participants: 120
    },
    {
      title: "Dark Sky Preservation",
      description: "Campaign to reduce light pollution and preserve natural night skies.",
      status: "Active",
      participants: 200
    },
    {
      title: "Meteor Observation Network",
      description: "Coordinated effort to track and study meteor showers and impacts.",
      status: "Research",
      participants: 30
    }
  ];

  const achievements = [
    "Discovered 12 new asteroid candidates in 2024",
    "Published 25+ research papers in peer-reviewed journals",
    "Organized 50+ public stargazing events",
    "Trained 300+ amateur astronomers",
    "Established 8 regional observation stations"
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary via-secondary to-primary/80 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="flex items-center mb-6">
                  <Satellite className="text-5xl mr-4" size={60} />
                  <div>
                    <h1 className="text-5xl font-bold mb-2">Sivali Astronomy Union</h1>
                    <p className="text-xl opacity-90">Exploring the Universe Together</p>
                  </div>
                </div>
                <p className="text-lg opacity-90 mb-8">
                  Founded in 2018, we are a passionate community of astronomers, researchers, and 
                  stargazers dedicated to advancing astronomical knowledge and inspiring the next 
                  generation of space explorers.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link href="/home">
                    <Button size="lg">
                      Take Quiz
                      <ChevronRight className="ml-2" size={20} />
                    </Button>
                  </Link>
                  <Button size="lg">
                    Learn More
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <img 
                  src={astro1} 
                  alt="Astronomy observation" 
                  className="w-full h-48 object-cover rounded-lg shadow-lg"
                />
                <img 
                  src={astro2} 
                  alt="Telescope setup" 
                  className="w-full h-48 object-cover rounded-lg shadow-lg mt-8"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12">
              <Card className="border-2 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center text-2xl">
                    <Target className="mr-3 text-primary" />
                    Our Mission
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    To advance astronomical research, education, and public outreach while fostering 
                    a global community of astronomy enthusiasts. We strive to make the wonders of 
                    the universe accessible to everyone through innovative programs and cutting-edge research.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 border-secondary/20">
                <CardHeader>
                  <CardTitle className="flex items-center text-2xl">
                    <Star className="mr-3 text-secondary" />
                    Our Vision
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    To be the leading astronomy organization that bridges the gap between professional 
                    research and public understanding, inspiring future generations to explore the 
                    cosmos and contribute to humanity's greatest adventure: understanding our universe.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Board Members */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">Leadership Board</h2>
              <p className="text-xl text-muted-foreground">
                Meet our distinguished team of astronomers and researchers
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {boardMembers.map((member, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <h3 className="text-lg font-semibold mb-1">{member.name}</h3>
                    <Badge variant="secondary" className="mb-2">{member.position}</Badge>
                    <p className="text-sm text-muted-foreground">{member.specialization}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Current Projects */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">Current Projects</h2>
              <p className="text-xl text-muted-foreground">
                Discover our ongoing research and community initiatives
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {projects.map((project, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl">{project.title}</CardTitle>
                      <Badge variant={project.status === 'Active' ? 'default' : 'secondary'}>
                        {project.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">{project.description}</p>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Users className="mr-2" size={16} />
                      {project.participants} participants
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Achievements */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">Our Achievements</h2>
              <p className="text-xl text-muted-foreground">
                Milestones that mark our journey in astronomical discovery
              </p>
            </div>

            <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
              <CardContent className="p-8">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Trophy className="text-primary mb-4" size={48} />
                    <h3 className="text-2xl font-semibold mb-4">Recent Accomplishments</h3>
                  </div>
                  <div className="space-y-3">
                    {achievements.map((achievement, index) => (
                      <div key={index} className="flex items-start">
                        <Star className="text-yellow-500 mr-3 mt-1 flex-shrink-0" size={16} />
                        <span className="text-muted-foreground">{achievement}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Information */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-8">Get In Touch</h2>
            
            <div className="grid md:grid-cols-3 gap-8 mb-12">
              <div className="flex flex-col items-center">
                <MapPin className="text-primary mb-4" size={48} />
                <h3 className="text-lg font-semibold mb-2">Location</h3>
                <p className="text-muted-foreground">Sivali Observatory<br />Astronomy Research Center</p>
              </div>
              <div className="flex flex-col items-center">
                <Mail className="text-primary mb-4" size={48} />
                <h3 className="text-lg font-semibold mb-2">Email</h3>
                <p className="text-muted-foreground">contact@sivali-astronomy.org<br />research@sivali-astronomy.org</p>
              </div>
              <div className="flex flex-col items-center">
                <Calendar className="text-primary mb-4" size={48} />
                <h3 className="text-lg font-semibold mb-2">Events</h3>
                <p className="text-muted-foreground">Monthly stargazing nights<br />Weekly research seminars</p>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <Link href="/home">
                <Button size="lg">
                  Take Our Quiz
                  <ExternalLink className="ml-2" size={20} />
                </Button>
              </Link>
              <Button variant="outline" size="lg">
                Join Our Community
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
