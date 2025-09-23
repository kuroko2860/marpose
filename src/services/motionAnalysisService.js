/**
 * Motion Analysis Service
 * Provides motion analysis capabilities for pose sequences
 */

import { analyzeMotion } from '../utils/motionAnalysis';

class MotionAnalysisService {
  constructor() {
    this.analysisCache = new Map();
    this.isAnalyzing = false;
  }

  /**
   * Analyze motion from a sequence of poses
   * @param {Array} poseSequence - Array of pose objects with keypoints and timestamps
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Motion analysis results
   */
  async analyzePoseSequence(poseSequence, options = {}) {
    if (!poseSequence || poseSequence.length < 2) {
      throw new Error('Insufficient pose data for motion analysis');
    }

    // Check cache first
    const cacheKey = this.generateCacheKey(poseSequence, options);
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey);
    }

    this.isAnalyzing = true;

    try {
      // Preprocess pose sequence
      const processedSequence = this.preprocessPoseSequence(poseSequence, options);
      
      // Perform motion analysis
      const analysis = analyzeMotion(processedSequence);
      
      // Post-process results
      const enhancedAnalysis = this.enhanceAnalysis(analysis, options);
      
      // Cache results
      this.analysisCache.set(cacheKey, enhancedAnalysis);
      
      return enhancedAnalysis;
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Analyze motion from captured images
   * @param {Array} capturedImages - Array of captured image objects
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Motion analysis results
   */
  async analyzeCapturedImages(capturedImages, options = {}) {
    if (!capturedImages || capturedImages.length < 2) {
      throw new Error('Insufficient captured images for motion analysis');
    }

    // Convert captured images to pose sequence
    const poseSequence = capturedImages
      .filter(img => img.poses && img.poses.length > 0)
      .map(img => ({
        keypoints_2d: img.poses[0].keypoints_2d || img.poses[0].keypoints,
        timestamp: new Date(img.timestamp).getTime(),
        source: img.source,
        sessionId: img.sessionId
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    return this.analyzePoseSequence(poseSequence, options);
  }

  /**
   * Analyze motion from key frames
   * @param {Array} keyFrames - Array of key frame objects
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Motion analysis results
   */
  async analyzeKeyFrames(keyFrames, options = {}) {
    if (!keyFrames || keyFrames.length < 2) {
      throw new Error('Insufficient key frames for motion analysis');
    }

    // Convert key frames to pose sequence
    const poseSequence = keyFrames
      .filter(frame => frame.pose && frame.pose.keypoints_2d)
      .map(frame => ({
        keypoints_2d: frame.pose.keypoints_2d,
        timestamp: new Date(frame.timestamp).getTime(),
        stabilityScore: frame.stabilityScore,
        type: frame.type
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    return this.analyzePoseSequence(poseSequence, options);
  }

  /**
   * Analyze real-time motion from current poses
   * @param {Array} currentPoses - Current pose data
   * @param {Array} poseHistory - Historical pose data
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Real-time motion analysis
   */
  async analyzeRealTimeMotion(currentPoses, poseHistory = [], options = {}) {
    if (!currentPoses || currentPoses.length === 0) {
      throw new Error('No current poses available for analysis');
    }

    // Combine current poses with history
    const allPoses = [...poseHistory, ...currentPoses.map(pose => ({
      keypoints_2d: pose.keypoints_2d,
      timestamp: Date.now(),
      track_id: pose.track_id
    }))];

    // Keep only recent poses (last 30 seconds by default)
    const timeWindow = options.timeWindow || 30000; // 30 seconds
    const cutoffTime = Date.now() - timeWindow;
    const recentPoses = allPoses.filter(pose => pose.timestamp > cutoffTime);

    return this.analyzePoseSequence(recentPoses, options);
  }

  /**
   * Compare two motion sequences
   * @param {Array} sequence1 - First pose sequence
   * @param {Array} sequence2 - Second pose sequence
   * @param {Object} options - Comparison options
   * @returns {Promise<Object>} Motion comparison results
   */
  async compareMotionSequences(sequence1, sequence2, options = {}) {
    const [analysis1, analysis2] = await Promise.all([
      this.analyzePoseSequence(sequence1, options),
      this.analyzePoseSequence(sequence2, options)
    ]);

    return this.compareAnalyses(analysis1, analysis2);
  }

  /**
   * Preprocess pose sequence for analysis
   * @private
   */
  preprocessPoseSequence(poseSequence, options) {
    let processed = [...poseSequence];

    // Filter out invalid poses
    processed = processed.filter(pose => 
      pose.keypoints_2d && 
      pose.keypoints_2d.length > 0 &&
      pose.timestamp
    );

    // Normalize timestamps if needed
    if (options.normalizeTimestamps) {
      const minTime = Math.min(...processed.map(p => p.timestamp));
      processed = processed.map(pose => ({
        ...pose,
        timestamp: pose.timestamp - minTime
      }));
    }

    // Smooth poses if requested
    if (options.smoothPoses && processed.length > 2) {
      processed = this.smoothPoseSequence(processed);
    }

    return processed;
  }

  /**
   * Smooth pose sequence to reduce noise
   * @private
   */
  smoothPoseSequence(poseSequence) {
    const smoothed = [];
    const windowSize = 3; // 3-point moving average

    for (let i = 0; i < poseSequence.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(poseSequence.length, i + Math.ceil(windowSize / 2));
      const window = poseSequence.slice(start, end);

      if (window.length > 0) {
        const smoothedPose = this.averagePoses(window);
        smoothed.push({
          ...poseSequence[i],
          keypoints_2d: smoothedPose
        });
      }
    }

    return smoothed;
  }

  /**
   * Average multiple poses to create a smoothed pose
   * @private
   */
  averagePoses(poses) {
    if (poses.length === 0) return [];
    if (poses.length === 1) return poses[0].keypoints_2d;

    const keypointCount = poses[0].keypoints_2d.length;
    const averaged = [];

    for (let i = 0; i < keypointCount; i++) {
      let sumX = 0, sumY = 0, count = 0;

      poses.forEach(pose => {
        const kp = pose.keypoints_2d[i];
        if (kp && kp.x !== undefined && kp.y !== undefined) {
          sumX += kp.x;
          sumY += kp.y;
          count++;
        }
      });

      if (count > 0) {
        averaged.push({
          x: sumX / count,
          y: sumY / count,
          score: 1.0
        });
      } else {
        averaged.push({ x: 0, y: 0, score: 0 });
      }
    }

    return averaged;
  }

  /**
   * Enhance analysis with additional insights
   * @private
   */
  enhanceAnalysis(analysis, options) {
    if (!analysis || analysis.error) return analysis;

    const enhanced = { ...analysis };

    // Add martial arts specific insights
    if (options.martialArtsMode) {
      enhanced.martialArtsInsights = this.generateMartialArtsInsights(analysis);
    }

    // Add performance metrics
    enhanced.performanceMetrics = this.calculatePerformanceMetrics(analysis);

    // Add improvement suggestions
    enhanced.improvementSuggestions = this.generateImprovementSuggestions(analysis);

    return enhanced;
  }

  /**
   * Generate martial arts specific insights
   * @private
   */
  generateMartialArtsInsights(analysis) {
    const insights = {
      technique: analysis.motionType,
      power: 'low',
      speed: 'low',
      accuracy: 'unknown',
      balance: 'unknown'
    };

    if (analysis.patterns) {
      // Assess power based on motion intensity and velocity
      if (analysis.patterns.intensity === 'high' && 
          analysis.patterns.motionMetrics.peakVelocity > 50) {
        insights.power = 'high';
      } else if (analysis.patterns.intensity === 'medium') {
        insights.power = 'medium';
      }

      // Assess speed based on motion magnitude and smoothness
      if (analysis.patterns.motionMetrics.averageMotionMagnitude > 10 && 
          analysis.patterns.smoothness === 'smooth') {
        insights.speed = 'high';
      } else if (analysis.patterns.motionMetrics.averageMotionMagnitude > 5) {
        insights.speed = 'medium';
      }

      // Assess balance based on stability and symmetry
      if (analysis.patterns.stability === 'stable' && 
          analysis.patterns.symmetry === 'symmetric') {
        insights.balance = 'excellent';
      } else if (analysis.patterns.stability === 'moderately_stable') {
        insights.balance = 'good';
      } else {
        insights.balance = 'needs_improvement';
      }
    }

    return insights;
  }

  /**
   * Calculate performance metrics
   * @private
   */
  calculatePerformanceMetrics(analysis) {
    const metrics = {
      overallScore: 0,
      techniqueScore: 0,
      powerScore: 0,
      speedScore: 0,
      balanceScore: 0
    };

    if (analysis.patterns) {
      // Calculate scores based on analysis results
      metrics.techniqueScore = this.calculateTechniqueScore(analysis);
      metrics.powerScore = this.calculatePowerScore(analysis);
      metrics.speedScore = this.calculateSpeedScore(analysis);
      metrics.balanceScore = this.calculateBalanceScore(analysis);
      
      // Overall score is average of all metrics
      metrics.overallScore = (
        metrics.techniqueScore + 
        metrics.powerScore + 
        metrics.speedScore + 
        metrics.balanceScore
      ) / 4;
    }

    return metrics;
  }

  /**
   * Calculate technique score
   * @private
   */
  calculateTechniqueScore(analysis) {
    let score = 50; // Base score

    if (analysis.motionType === 'punching' || analysis.motionType === 'kicking') {
      score += 20;
    }

    if (analysis.patterns.smoothness === 'smooth') {
      score += 15;
    } else if (analysis.patterns.smoothness === 'jerky') {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate power score
   * @private
   */
  calculatePowerScore(analysis) {
    let score = 50; // Base score

    if (analysis.patterns.intensity === 'high') {
      score += 25;
    } else if (analysis.patterns.intensity === 'medium') {
      score += 10;
    }

    if (analysis.patterns.motionMetrics.peakVelocity > 50) {
      score += 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate speed score
   * @private
   */
  calculateSpeedScore(analysis) {
    let score = 50; // Base score

    if (analysis.patterns.motionMetrics.averageMotionMagnitude > 10) {
      score += 20;
    } else if (analysis.patterns.motionMetrics.averageMotionMagnitude > 5) {
      score += 10;
    }

    if (analysis.patterns.smoothness === 'smooth') {
      score += 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate balance score
   * @private
   */
  calculateBalanceScore(analysis) {
    let score = 50; // Base score

    if (analysis.patterns.stability === 'stable') {
      score += 25;
    } else if (analysis.patterns.stability === 'moderately_stable') {
      score += 10;
    }

    if (analysis.patterns.symmetry === 'symmetric') {
      score += 15;
    } else if (analysis.patterns.symmetry === 'asymmetric') {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate improvement suggestions
   * @private
   */
  generateImprovementSuggestions(analysis) {
    const suggestions = [];

    if (analysis.patterns.intensity === 'low') {
      suggestions.push('Increase movement intensity for better power development');
    }

    if (analysis.patterns.symmetry === 'asymmetric') {
      suggestions.push('Focus on symmetric movements to improve balance');
    }

    if (analysis.patterns.stability === 'unstable') {
      suggestions.push('Work on stability and control in your movements');
    }

    if (analysis.patterns.smoothness === 'jerky') {
      suggestions.push('Practice smoother, more controlled movements');
    }

    if (analysis.motionType === 'unknown') {
      suggestions.push('Ensure clear, deliberate movements for better technique recognition');
    }

    return suggestions;
  }

  /**
   * Compare two motion analyses
   * @private
   */
  compareAnalyses(analysis1, analysis2) {
    return {
      sequence1: analysis1,
      sequence2: analysis2,
      comparison: {
        motionTypeMatch: analysis1.motionType === analysis2.motionType,
        intensityDifference: this.calculateIntensityDifference(analysis1, analysis2),
        stabilityDifference: this.calculateStabilityDifference(analysis1, analysis2),
        overallSimilarity: this.calculateOverallSimilarity(analysis1, analysis2)
      }
    };
  }

  /**
   * Calculate intensity difference between analyses
   * @private
   */
  calculateIntensityDifference(analysis1, analysis2) {
    const intensityMap = { low: 1, medium: 2, high: 3 };
    const intensity1 = intensityMap[analysis1.patterns?.intensity] || 0;
    const intensity2 = intensityMap[analysis2.patterns?.intensity] || 0;
    return Math.abs(intensity1 - intensity2);
  }

  /**
   * Calculate stability difference between analyses
   * @private
   */
  calculateStabilityDifference(analysis1, analysis2) {
    const stabilityMap = { unstable: 1, moderately_stable: 2, stable: 3 };
    const stability1 = stabilityMap[analysis1.patterns?.stability] || 0;
    const stability2 = stabilityMap[analysis2.patterns?.stability] || 0;
    return Math.abs(stability1 - stability2);
  }

  /**
   * Calculate overall similarity between analyses
   * @private
   */
  calculateOverallSimilarity(analysis1, analysis2) {
    let similarity = 0;
    let factors = 0;

    // Motion type similarity
    if (analysis1.motionType === analysis2.motionType) {
      similarity += 40;
    }
    factors += 40;

    // Intensity similarity
    if (analysis1.patterns?.intensity === analysis2.patterns?.intensity) {
      similarity += 20;
    }
    factors += 20;

    // Stability similarity
    if (analysis1.patterns?.stability === analysis2.patterns?.stability) {
      similarity += 20;
    }
    factors += 20;

    // Symmetry similarity
    if (analysis1.patterns?.symmetry === analysis2.patterns?.symmetry) {
      similarity += 20;
    }
    factors += 20;

    return factors > 0 ? (similarity / factors) * 100 : 0;
  }

  /**
   * Generate cache key for analysis
   * @private
   */
  generateCacheKey(poseSequence, options) {
    const sequenceHash = poseSequence
      .map(pose => `${pose.timestamp}-${pose.keypoints_2d?.length || 0}`)
      .join('|');
    const optionsHash = JSON.stringify(options);
    return `${sequenceHash}-${optionsHash}`;
  }

  /**
   * Clear analysis cache
   */
  clearCache() {
    this.analysisCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.analysisCache.size,
      isAnalyzing: this.isAnalyzing
    };
  }
}

// Create singleton instance
const motionAnalysisService = new MotionAnalysisService();

export default motionAnalysisService;
